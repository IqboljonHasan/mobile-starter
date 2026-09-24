import { roundAmount } from "@/lib/money";
import type {
	Contact,
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
 * All four sit in DEBT_CATEGORY_IDS (lib/seed.ts), so they stay out of the
 * income/expense stats unless the user opts back in from Settings — borrowing
 * money is not earning it.
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

export function debtsOfContact(debts: Debt[], contactId: string): Debt[] {
	return debts.filter((d) => d.contactId === contactId);
}

/**
 * Open debts first, then the most pressing: a due date that has passed or is
 * close outranks one far off, and a debt with no date agreed sorts after those
 * that have one. Settled debts fall to the bottom, newest first.
 */
export function sortDebts(debts: Debt[], today: string): Debt[] {
	return [...debts].sort((a, b) => {
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
	});
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
