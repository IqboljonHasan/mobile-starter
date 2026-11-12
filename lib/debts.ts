import type { CategoryColor } from "@/lib/categoryColors";
import { formatDayMonth } from "@/lib/date";
import { formatAmount, roundAmount } from "@/lib/money";
import type {
	Contact,
	ContactTag,
	Debt,
	DebtDirection,
	DebtPayment,
	IconName,
	TransactionInput,
	TxType,
} from "@/lib/types";

/**
 * Pure read-side logic for the Debts tab. Nothing here touches storage or
 * React — LedgerContext calls these on the arrays it already holds.
 *
 * A debt is deliberately *not* a second ledger. Every movement it records —
 * the principal, and each payment against it — writes a real transaction under
 * one of the four debt categories the app already ships with, so the money
 * genuinely enters and leaves wallets. What the debt itself adds is the thing
 * a flat list of transactions cannot answer: how much of *this particular*
 * loan is still outstanding, and who it is with.
 *
 * The four movements and the categories they write to:
 *
 *   qarz olish   borrow  → income   cat_debts      money in, I now owe it
 *   to'lash      repay   → expense  cat_loans-out  money out, my debt shrinks
 *   qarz berish  lend    → expense  cat_debs-out   money out, I'm now owed it
 *   undirish     collect → income   cat_loans      money in, their debt shrinks
 *
 * All four sit in DEBT_CATEGORY_IDS (lib/seed.ts), so the "Qarzsiz" filter on
 * Tahlil and the ledger can take them out — borrowing money is not earning it.
 */

/** Money taken — an income under "Qarz olish". */
export const BORROW_CATEGORY_ID = "cat_debts";
/** Money collected on a loan — an income under "Qarz undirish". */
export const COLLECT_CATEGORY_ID = "cat_loans";
/** Money lent out — an expense under "Qarz berish". */
export const LEND_CATEGORY_ID = "cat_debs-out";
/** Money paid back — an expense under "Qarz to'lovi". */
export const REPAY_CATEGORY_ID = "cat_loans-out";

export type DirectionMeta = {
	key: DebtDirection;
	/** How the debt itself is named — "Qarz oldim". */
	label: string;
	/** The list's column heading — "Olganlarim". */
	plural: string;
	/** What paying it off is called — "To'lash" vs "Undirish". */
	payLabel: string;
	/** Heading over the payment history. */
	payPlural: string;
	/** What the person on the other side is to the user. */
	counterparty: string;
	icon: IconName;
	/** Money coming in reads green, money going out reads red — the same
	 *  convention the rest of the app uses, applied to the principal. */
	tone: "success" | "danger";
};

export const DIRECTION_META: Record<DebtDirection, DirectionMeta> = {
	borrowed: {
		key: "borrowed",
		label: "Qarz oldim",
		plural: "Olgan qarzlarim",
		payLabel: "To'lash",
		payPlural: "To'lovlar",
		counterparty: "Kimdan",
		icon: "arrow-down-circle-outline",
		tone: "success",
	},
	lent: {
		key: "lent",
		label: "Qarz berdim",
		plural: "Bergan qarzlarim",
		payLabel: "Undirish",
		payPlural: "Undirilganlar",
		counterparty: "Kimga",
		icon: "arrow-up-circle-outline",
		tone: "danger",
	},
};

/** Which side of the ledger the principal lands on. */
export function principalType(direction: DebtDirection): TxType {
	return direction === "borrowed" ? "income" : "expense";
}

/** Which side a payment lands on — always the opposite of the principal. */
export function paymentType(direction: DebtDirection): TxType {
	return direction === "borrowed" ? "expense" : "income";
}

export function principalCategoryId(direction: DebtDirection): string {
	return direction === "borrowed" ? BORROW_CATEGORY_ID : LEND_CATEGORY_ID;
}

export function paymentCategoryId(direction: DebtDirection): string {
	return direction === "borrowed" ? REPAY_CATEGORY_ID : COLLECT_CATEGORY_ID;
}

/**
 * What "Qarzdorga yuborish" sends: a short, polite note of the debt as the
 * form holds it — who, how much, since when, and until when — for the user to
 * pass on through whichever messenger they pick.
 */
export function debtShareMessage({
	direction,
	name,
	amount,
	remaining,
	unit,
	date,
	dueDate,
}: {
	direction: DebtDirection;
	name: string;
	amount: number;
	/** What is still owed, when some of it has come back already. */
	remaining?: number;
	unit: string;
	date: string;
	dueDate: string | null;
}): string {
	const lines = [
		`Assalomu alaykum${name ? `, ${name}` : ""}!`,
		direction === "lent"
			? `${formatDayMonth(date)} kuni sizga ${formatAmount(amount, unit)} qarz berganman.`
			: `${formatDayMonth(date)} kuni sizdan ${formatAmount(amount, unit)} qarz olganman.`,
	];
	if (remaining !== undefined && remaining > 0 && remaining < amount) {
		lines.push(`Qolgan qarz: ${formatAmount(remaining, unit)}.`);
	}
	if (dueDate) lines.push(`Qaytarish muddati: ${formatDayMonth(dueDate)}.`);
	return lines.join("\n");
}

/** How each contact tag is named, and the hue its pill is drawn in. */
export const TAG_META: Record<ContactTag, { label: string; plural: string; color: CategoryColor }> = {
	friend: { label: "Do'st", plural: "Do'stlar", color: "blue" },
	relative: { label: "Qarindosh", plural: "Qarindoshlar", color: "orange" },
};

/* Amounts ------------------------------------------------------------------ */

/** Everything paid against a debt so far, in the debt's own unit. */
export function paidAmount(debt: Debt): number {
	return roundAmount(
		debt.payments.reduce((acc, p) => acc + p.amount, 0),
		debt.unit,
	);
}

/**
 * What is still outstanding. Never negative: overpaying settles the debt
 * rather than turning it into a debt the other way round, which would be a
 * second loan the user never recorded.
 */
export function remainingAmount(debt: Debt): number {
	return Math.max(roundAmount(debt.amount - paidAmount(debt), debt.unit), 0);
}

/** 0–1 of the principal that has been paid off — the progress bar's length. */
export function paidShare(debt: Debt): number {
	if (debt.amount <= 0) return 1;
	return Math.min(paidAmount(debt) / debt.amount, 1);
}

export function isSettled(debt: Debt): boolean {
	return remainingAmount(debt) <= 0;
}

export type DebtStatus = "open" | "overdue" | "settled";

/** A debt is only overdue while it's still open and its day has passed. */
export function debtStatus(debt: Debt, today: string): DebtStatus {
	if (isSettled(debt)) return "settled";
	if (debt.dueDate && debt.dueDate < today) return "overdue";
	return "open";
}

/** Days until the due date; negative once it's past. Null without a due date. */
export function daysUntilDue(debt: Debt, today: string): number | null {
	if (!debt.dueDate) return null;
	const due = Date.parse(`${debt.dueDate}T00:00:00`);
	const now = Date.parse(`${today}T00:00:00`);
	if (Number.isNaN(due) || Number.isNaN(now)) return null;
	return Math.round((due - now) / 86_400_000);
}

/* Totals ------------------------------------------------------------------- */

export type DebtTotal = {
	unit: string;
	/** Still owed to the user, across every open debt they lent. */
	owedToMe: number;
	/** Still owed by the user. */
	owedByMe: number;
};

/**
 * Outstanding totals per unit, exactly as every other total in this app:
 * never summed across currencies, since a dollar loan and a som loan don't add
 * up to a number that means anything.
 */
export function outstandingByUnit(debts: Debt[]): DebtTotal[] {
	const totals = new Map<string, DebtTotal>();

	for (const debt of debts) {
		const remaining = remainingAmount(debt);
		if (remaining <= 0) continue;
		const row = totals.get(debt.unit) ?? {
			unit: debt.unit,
			owedToMe: 0,
			owedByMe: 0,
		};
		if (debt.direction === "lent") row.owedToMe += remaining;
		else row.owedByMe += remaining;
		totals.set(debt.unit, row);
	}

	return [...totals.values()].sort(
		(a, b) => b.owedToMe + b.owedByMe - (a.owedToMe + a.owedByMe),
	);
}

/** The same totals narrowed to one person — what a contact row shows. */
export function contactTotals(debts: Debt[], contactId: string): DebtTotal[] {
	return outstandingByUnit(debts.filter((d) => d.contactId === contactId));
}

/**
 * Where things stand with one person, netted in one unit: positive when they
 * owe the user, negative when the user owes them. The preferred unit when the
 * person has debts in it, otherwise whichever holds the most. Null when
 * nothing is open with them.
 */
export function contactBalance(
	debts: Debt[],
	contactId: string,
	preferredUnit?: string,
): { unit: string; net: number } | null {
	const totals = contactTotals(debts, contactId);
	if (totals.length === 0) return null;
	const total = totals.find((t) => t.unit === preferredUnit) ?? totals[0];
	return { unit: total.unit, net: roundAmount(total.owedToMe - total.owedByMe, total.unit) };
}

/** "Sizga qarzdor · 600 000 so'm", "Siz qarzdorsiz · …" or "Qarz yo'q", with its tone. */
export function contactBalanceText(balance: { unit: string; net: number } | null): {
	text: string;
	tone: "success" | "danger" | "muted";
} {
	if (!balance || balance.net === 0) return { text: "Qarz yo'q", tone: "muted" };
	return balance.net > 0
		? { text: `Sizga qarzdor · ${formatAmount(balance.net, balance.unit)}`, tone: "success" }
		: { text: `Siz qarzdorsiz · ${formatAmount(-balance.net, balance.unit)}`, tone: "danger" };
}

export function debtsOfContact(debts: Debt[], contactId: string): Debt[] {
	return debts.filter((d) => d.contactId === contactId);
}

/**
 * Open debts first, then the most pressing: a due date that has passed or is
 * close outranks one far off, and a debt with no date agreed sorts after those
 * that have one. Settled debts fall to the bottom, newest first.
 */
function compareDebts(a: Debt, b: Debt, today: string): number {
	const settledA = isSettled(a);
	const settledB = isSettled(b);
	if (settledA !== settledB) return settledA ? 1 : -1;
	if (settledA) return b.createdAt - a.createdAt;

	const dueA = daysUntilDue(a, today);
	const dueB = daysUntilDue(b, today);
	if (dueA !== null && dueB !== null) return dueA - dueB;
	if (dueA !== null) return -1;
	if (dueB !== null) return 1;
	return b.createdAt - a.createdAt;
}

/** The debts in the order of `compareDebts` above. */
export function sortDebts(debts: Debt[], today: string): Debt[] {
	return [...debts].sort((a, b) => compareDebts(a, b, today));
}

/**
 * Everything with one person, rolled into the single line the Qarzlar list
 * shows for them.
 */
export type ContactDebtGroup = {
	contactId: string;
	/** The person's debts, most pressing first (`sortDebts`). */
	debts: Debt[];
	/** The most urgent state among them: overdue over open over settled. */
	status: DebtStatus;
	/**
	 * Where things stand per unit, netted: what they still owe the user less
	 * what the user still owes them. Positive means they owe. Only units with
	 * something outstanding appear, and never summed across currencies.
	 */
	net: { unit: string; amount: number }[];
	/** The earliest due date among the open debts, if any has one. */
	nextDue: string | null;
	/**
	 * 0–1 of the open debts' principal paid back so far — only when every open
	 * debt runs the same way and in the same unit. Mixed, "% qaytarildi" would
	 * not say who returned what.
	 */
	paidShare: number | null;
};

/**
 * One group per person, ordered by their most pressing debt — so whoever
 * holds the most overdue loan comes first, as a single debt would.
 */
export function groupDebtsByContact(debts: Debt[], today: string): ContactDebtGroup[] {
	const byContact = new Map<string, Debt[]>();
	for (const debt of debts) {
		const list = byContact.get(debt.contactId);
		if (list) list.push(debt);
		else byContact.set(debt.contactId, [debt]);
	}

	const groups = [...byContact.entries()].map(([contactId, list]): ContactDebtGroup => {
		const sorted = sortDebts(list, today);
		const net = new Map<string, number>();
		let status: DebtStatus = "settled";
		let nextDue: string | null = null;
		const open = sorted.filter((d) => !isSettled(d));
		const uniform = open.every((d) => d.direction === open[0]?.direction && d.unit === open[0]?.unit);
		const principal = open.reduce((acc, d) => acc + d.amount, 0);
		for (const debt of sorted) {
			const state = debtStatus(debt, today);
			if (state === "settled") continue;
			if (state === "overdue" || status === "settled") status = state;
			if (debt.dueDate && (nextDue === null || debt.dueDate < nextDue)) nextDue = debt.dueDate;
			const signed = (debt.direction === "lent" ? 1 : -1) * remainingAmount(debt);
			net.set(debt.unit, (net.get(debt.unit) ?? 0) + signed);
		}
		return {
			contactId,
			debts: sorted,
			status,
			// In the order the units first appear among the sorted debts: amounts
			// in different currencies can't be ranked against each other.
			net: [...net.entries()].map(([unit, amount]) => ({ unit, amount: roundAmount(amount, unit) })),
			nextDue,
			paidShare:
				open.length > 0 && uniform && principal > 0
					? Math.min(open.reduce((acc, d) => acc + paidAmount(d), 0) / principal, 1)
					: null,
		};
	});

	return groups.sort((a, b) => compareDebts(a.debts[0], b.debts[0], today));
}

/**
 * How a net reads in words, from the user's side: "Sizga qarzdor" when the
 * person owes, "Siz qarzdorsiz" when the user does, "Hisob teng" when the two
 * directions cancel out.
 */
export function netLabel(amount: number): string {
	return amount > 0 ? "Sizga qarzdor" : amount < 0 ? "Siz qarzdorsiz" : "Hisob teng";
}

/** "Aziz Karimov" → "Aziz": how a person is called in a sentence about them. */
export function shortName(name: string): string {
	return name.trim().split(/\s+/)[0] || name;
}

/**
 * A name with the dative "-ga" the way Uzbek attaches it — "Azizga", and after
 * k and q the assimilated "-ka" and "-qa": "Bekka", "Farruqqa".
 */
export function dativeOf(name: string): string {
	const last = name.trim().slice(-1).toLowerCase();
	return `${name.trim()}${last === "k" ? "ka" : last === "q" ? "qa" : "ga"}`;
}

/**
 * How a due date reads on a chip, and how loudly: red once it has passed,
 * amber within a week, quiet further out.
 */
export function dueInfo(
	dueDate: string,
	today: string,
): { text: string; tone: "danger" | "warning" | "neutral" } {
	const days = Math.round(
		(Date.parse(`${dueDate}T00:00:00`) - Date.parse(`${today}T00:00:00`)) / 86_400_000,
	);
	const day = formatDayMonth(dueDate);
	if (days < 0) return { text: `Muddati o'tgan: ${day} · ${-days} kun`, tone: "danger" };
	if (days === 0) return { text: `Muddat: bugun, ${day}`, tone: "warning" };
	return { text: `Muddat: ${day} · ${days} kun qoldi`, tone: days <= 7 ? "warning" : "neutral" };
}

/* History ------------------------------------------------------------------ */

/**
 * Which way one entry in a debt history moved money, from the user's side:
 * money lent or borrowed, and money collected back or repaid.
 */
export type DebtEventKind = "lent" | "borrowed" | "collected" | "repaid";

export type DebtEvent = {
	/** The debt's id for its principal, the payment's for a payment. */
	id: string;
	kind: DebtEventKind;
	debt: Debt;
	/** Null for the principal itself. */
	payment: DebtPayment | null;
	amount: number;
	unit: string;
	date: string;
	note: string;
	createdAt: number;
	/**
	 * Where things stood in this unit right after this entry, across the debts
	 * the history was built from: positive when the other person owes the
	 * user, negative when the user owes them.
	 */
	balanceAfter: number;
};

/**
 * Every principal and payment of the given debts as one history, oldest
 * first, each carrying the running balance it left behind.
 *
 * The balance moves by what each entry changes in its debt's *outstanding*
 * amount, the same clamped figure `remainingAmount` gives — so overpaying a
 * debt doesn't swing the balance past zero, and the last entry's balance is
 * exactly what the Qarzlar list nets the person to.
 */
export function debtTimeline(debts: Debt[]): DebtEvent[] {
	const events: Omit<DebtEvent, "balanceAfter">[] = debts.flatMap((debt) => [
		{
			id: debt.id,
			kind: debt.direction,
			debt,
			payment: null,
			amount: debt.amount,
			unit: debt.unit,
			date: debt.date,
			note: debt.description,
			createdAt: debt.createdAt,
		},
		...debt.payments.map((payment) => ({
			id: payment.id,
			kind: (debt.direction === "lent" ? "collected" : "repaid") as DebtEventKind,
			debt,
			payment,
			amount: payment.amount,
			unit: debt.unit,
			date: payment.date,
			note: payment.note,
			createdAt: payment.createdAt,
		})),
	]);
	events.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));

	// A payment recorded on a day before its own loan counts from the loan on.
	const opened = new Set<string>();
	const paid = new Map<string, number>();
	const balance = new Map<string, number>();
	const outstanding = (debt: Debt) =>
		opened.has(debt.id) ? Math.max(debt.amount - (paid.get(debt.id) ?? 0), 0) : 0;

	return events.map((event) => {
		const before = outstanding(event.debt);
		if (event.payment) paid.set(event.debt.id, (paid.get(event.debt.id) ?? 0) + event.amount);
		else opened.add(event.debt.id);
		const change = outstanding(event.debt) - before;
		const sign = event.debt.direction === "lent" ? 1 : -1;
		const next = roundAmount((balance.get(event.unit) ?? 0) + sign * change, event.unit);
		balance.set(event.unit, next);
		return { ...event, balanceAfter: next };
	});
}

/**
 * What "Hisobotni ulashish" sends: the whole history with one person, written
 * to them, ending with where things stand in each unit.
 */
export function contactShareMessage(name: string, events: DebtEvent[]): string {
	const lines = [`Assalomu alaykum${name ? `, ${name}` : ""}!`, "Hisob-kitobimiz:"];
	for (const e of events) {
		const amount = formatAmount(e.amount, e.unit);
		const what =
			e.kind === "lent"
				? `sizga ${amount} qarz berdim`
				: e.kind === "borrowed"
					? `sizdan ${amount} qarz oldim`
					: e.kind === "collected"
						? `${amount} qaytardingiz`
						: `${amount} qaytardim`;
		lines.push(`• ${formatDayMonth(e.date)}: ${what}`);
	}
	const last = new Map<string, number>();
	for (const e of events) last.set(e.unit, e.balanceAfter);
	for (const [unit, net] of last) {
		lines.push(
			net > 0
				? `Qolgan qarzingiz: ${formatAmount(net, unit)}.`
				: net < 0
					? `Qolgan qarzim: ${formatAmount(-net, unit)}.`
					: "Hisob-kitob teng.",
		);
	}
	return lines.join("\n");
}

/* Ledger entries ----------------------------------------------------------- */

/**
 * The transaction a debt's principal should write.
 *
 * The description carries the person's name rather than only the debt's own
 * note, because this entry is also read from the Income and Expense tabs,
 * where "Qarz olish · 500 000" with no name attached tells the user nothing.
 */
export function principalInput(
	debt: Pick<
		Debt,
		| "id"
		| "direction"
		| "amount"
		| "unit"
		| "method"
		| "walletId"
		| "description"
		| "date"
	>,
	contactName: string,
): TransactionInput {
	return {
		type: principalType(debt.direction),
		amount: debt.amount,
		unit: debt.unit,
		method: debt.method,
		categoryId: principalCategoryId(debt.direction),
		subcategoryId: null,
		description: describe(contactName, debt.description),
		date: debt.date,
		walletId: debt.walletId,
		debtId: debt.id,
	};
}

/** The transaction one payment should write. */
export function paymentInput(
	debt: Pick<Debt, "id" | "direction" | "unit">,
	payment: Pick<DebtPayment, "amount" | "date" | "method" | "walletId" | "note">,
	contactName: string,
): TransactionInput {
	return {
		type: paymentType(debt.direction),
		amount: payment.amount,
		unit: debt.unit,
		method: payment.method,
		categoryId: paymentCategoryId(debt.direction),
		subcategoryId: null,
		description: describe(contactName, payment.note),
		date: payment.date,
		walletId: payment.walletId,
		debtId: debt.id,
	};
}

/** "Alisher — kredit uchun", or just the name when there's no note. */
function describe(contactName: string, note: string): string {
	const name = contactName.trim();
	const rest = note.trim();
	if (!name) return rest;
	return rest ? `${name} — ${rest}` : name;
}

/* Contacts ----------------------------------------------------------------- */

export function contactById(contacts: Contact[], id: string | null): Contact | null {
	if (!id) return null;
	return contacts.find((c) => c.id === id) ?? null;
}

/** Display name for any contact id, including one since deleted. */
export function contactName(contacts: Contact[], id: string | null): string {
	return contactById(contacts, id)?.name ?? "Noma'lum";
}

/** Up to two letters for the avatar — "Alisher Navoiy" → "AN". */
export function contactInitials(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return "?";
	if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
	return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * A stable palette slot per contact, so the same person keeps the same colour
 * everywhere without one being stored on the record. Hashed from the id rather
 * than the list position: inserting a contact must not repaint the others.
 */
export function contactColorIndex(id: string): number {
	let hash = 0;
	for (let i = 0; i < id.length; i++) {
		hash = (hash * 31 + id.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

/** Alphabetical, with the ones actually owing something first. */
export function sortContacts(contacts: Contact[], debts: Debt[]): Contact[] {
	const open = new Set(
		debts.filter((d) => !isSettled(d)).map((d) => d.contactId),
	);
	return [...contacts].sort((a, b) => {
		const openA = open.has(a.id);
		const openB = open.has(b.id);
		if (openA !== openB) return openA ? -1 : 1;
		return a.name.localeCompare(b.name, "uz");
	});
}

/**
 * Normalises a phone number down to its digits so two spellings of the same
 * number — "+998 90 123-45-67" and "998901234567" — are recognised as one.
 * Only ever used to compare, never to display: what the user typed is what
 * they see.
 */
export function normalizePhone(phone: string): string {
	return phone.replace(/\D/g, "");
}

/** An existing contact matching an imported one, by source id then by number. */
export function matchContact(
	contacts: Contact[],
	candidate: { sourceId: string | null; phone: string },
): Contact | null {
	if (candidate.sourceId) {
		const bySource = contacts.find((c) => c.sourceId === candidate.sourceId);
		if (bySource) return bySource;
	}
	const digits = normalizePhone(candidate.phone);
	if (!digits) return null;
	return contacts.find((c) => normalizePhone(c.phone) === digits) ?? null;
}
