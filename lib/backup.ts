import { isCategoryColor } from "@/lib/categoryColors";
import { toISODate } from "@/lib/date";
import { asPayMethod, DEFAULT_UNIT, unitByCode } from "@/lib/money";
import { redistribute, SEED_WALLETS } from "@/lib/wallets";
import type {
	Allocation,
	Category,
	Contact,
	Debt,
	DebtDirection,
	DebtPayment,
	IconName,
	Subcategory,
	Transaction,
	Transfer,
	TxType,
	Wallet,
} from "@/lib/types";

/**
 * The backup file format: turning the ledger into text, and validating text
 * back into a ledger. Reading and writing actual files lives next door in
 * lib/backupFile.ts, which keeps everything here pure and testable.
 *
 * Everything lives on the device and nothing is synced, so a backup file is the
 * only way a ledger survives a lost phone or moves to a new one. The file is
 * plain indented JSON on purpose — a backup nobody can open is a backup nobody
 * can trust, and it stays repairable by hand.
 *
 * An imported file is treated as hostile: it may have been hand-edited, cut
 * short by a failed copy, or not be ours at all. Every record is checked before
 * it reaches the store, because a malformed amount or date would otherwise only
 * surface much later, as a screen that won't render.
 */

/** Marks a file as ours. Checked on import before anything else is read. */
export const BACKUP_FORMAT = "kirciq.backup";

/**
 * Bump when the shape changes; `parseBackup` refuses anything newer.
 *
 * 2 added wallets, transfers, and the allocation each income carries. A
 * version 1 file still imports: it simply has no wallets of its own, so the
 * starter set stands in and its entries read as unallocated until the wallets
 * screen redistributes them.
 *
 * 3 added contacts and debts. Older files import with neither, which is the
 * honest reading — a ledger written before the Debts tab existed recorded its
 * borrowing as plain entries under the debt categories, and those come across
 * untouched.
 */
export const BACKUP_VERSION = 3;

/** The part of the ledger worth carrying between devices. */
export type BackupPayload = {
	categories: Category[];
	transactions: Transaction[];
	wallets: Wallet[];
	transfers: Transfer[];
	contacts: Contact[];
	debts: Debt[];
	defaultUnit: string;
};

type BackupFile = BackupPayload & {
	format: typeof BACKUP_FORMAT;
	version: number;
	exportedAt: string;
};

export type ParseResult =
	| {
			ok: true;
			payload: BackupPayload;
			skipped: number;
			/**
			 * Whether the file brought wallets of its own. When it didn't, the
			 * payload's wallets are only the starter set standing in, and its
			 * entries carry no splits worth keeping.
			 */
			hasWallets: boolean;
	  }
	| { ok: false; error: string };

/* Writing ------------------------------------------------------------------ */

function pad(value: number): string {
	return `${value}`.padStart(2, "0");
}

/** Carries the clock as well as the day, so two exports never collide. */
export function backupFileName(now: Date = new Date()): string {
	const stamp = `${toISODate(now)}-${pad(now.getHours())}${pad(now.getMinutes())}`;
	return `taqsim-zaxira-${stamp}.json`;
}

export function serializeBackup(
	payload: BackupPayload,
	now: Date = new Date(),
): string {
	const file: BackupFile = {
		format: BACKUP_FORMAT,
		version: BACKUP_VERSION,
		exportedAt: now.toISOString(),
		...payload,
	};
	// Indented so the file stays readable, and diffable, outside the app.
	return JSON.stringify(file, null, 2);
}

/* Reading ------------------------------------------------------------------ */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTxType(value: unknown): value is TxType {
	return value === "income" || value === "expense";
}

function nonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.length > 0;
}

function parseSubcategory(raw: unknown): Subcategory | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null;
	if (typeof raw.color !== "string" || !isCategoryColor(raw.color)) return null;
	return { id: raw.id, name: raw.name, color: raw.color };
}

function parseCategory(raw: unknown): Category | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null;
	if (!isTxType(raw.type)) return null;
	if (typeof raw.color !== "string" || !isCategoryColor(raw.color)) return null;
	if (!nonEmptyString(raw.icon)) return null;

	// A bad subcategory costs its parent nothing — drop it and keep the category.
	const subcategories = Array.isArray(raw.subcategories)
		? raw.subcategories
				.map(parseSubcategory)
				.filter((s): s is Subcategory => s !== null)
		: [];

	return {
		id: raw.id,
		type: raw.type,
		name: raw.name,
		color: raw.color,
		// Unknown glyph names render as nothing rather than throwing, so the name
		// only has to be a string for the app to stay on its feet.
		icon: raw.icon as IconName,
		subcategories,
		// Absent in version 1 files. An unassigned category simply spends from no
		// wallet, so a miss here costs the mapping, never the category. A file
		// written before the mapping went many-to-many carries the old singular
		// `walletId` instead — read as a one-item set rather than dropped.
		walletIds: Array.isArray(raw.walletIds)
			? raw.walletIds.filter(nonEmptyString)
			: nonEmptyString(raw.walletId)
				? [raw.walletId]
				: [],
		splitIncome: raw.splitIncome === false ? false : true,
	};
}

function parseWallet(raw: unknown): Wallet | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null;
	if (typeof raw.color !== "string" || !isCategoryColor(raw.color)) return null;
	if (!nonEmptyString(raw.icon)) return null;

	// A percentage outside 0–100 would let a split claim more than it divided.
	const percent =
		typeof raw.percent === "number" && Number.isFinite(raw.percent)
			? Math.min(Math.max(raw.percent, 0), 100)
			: 0;

	return {
		id: raw.id,
		name: raw.name,
		color: raw.color,
		icon: raw.icon as IconName,
		percent,
	};
}

function parseAllocation(raw: unknown): Allocation | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.walletId)) return null;
	if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null;
	if (raw.amount < 0) return null;
	return { walletId: raw.walletId, amount: raw.amount };
}

function parseTransfer(raw: unknown): Transfer | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.unit)) return null;
	if (!nonEmptyString(raw.fromWalletId) || !nonEmptyString(raw.toWalletId)) return null;
	// A transfer to itself moves nothing and would only confuse the history.
	if (raw.fromWalletId === raw.toWalletId) return null;
	if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null;
	if (raw.amount <= 0) return null;
	if (typeof raw.date !== "string" || !ISO_DATE.test(raw.date)) return null;

	return {
		id: raw.id,
		fromWalletId: raw.fromWalletId,
		toWalletId: raw.toWalletId,
		amount: raw.amount,
		unit: raw.unit,
		date: raw.date,
		note: typeof raw.note === "string" ? raw.note : "",
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
	};
}

function parseTransaction(raw: unknown): Transaction | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.unit)) return null;
	if (!isTxType(raw.type)) return null;
	if (typeof raw.categoryId !== "string") return null;
	// The sign lives in `type`, and a NaN here would spread through every total.
	if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null;
	if (raw.amount < 0) return null;
	if (typeof raw.date !== "string" || !ISO_DATE.test(raw.date)) return null;

	return {
		id: raw.id,
		type: raw.type,
		amount: raw.amount,
		unit: raw.unit,
		categoryId: raw.categoryId,
		date: raw.date,
		// Absent in files written before the field existed, and in anything
		// hand-edited; both read as card rather than failing the entry.
		method: asPayMethod(raw.method),
		// These three are recoverable, so a miss costs the entry its label or its
		// place in the day's order — not the entry itself.
		subcategoryId: nonEmptyString(raw.subcategoryId) ? raw.subcategoryId : null,
		description: typeof raw.description === "string" ? raw.description : "",
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
		// Both absent in version 1 files, and both recoverable from the wallets
		// screen, so a miss leaves the entry out of the balances rather than
		// dropping the entry.
		allocations: Array.isArray(raw.allocations)
			? raw.allocations.map(parseAllocation).filter((a): a is Allocation => a !== null)
			: [],
		walletId: nonEmptyString(raw.walletId) ? raw.walletId : null,
		// Absent on everything written before the Debts tab, and on every entry
		// the user typed in by hand — which is exactly what a null means here.
		debtId: nonEmptyString(raw.debtId) ? raw.debtId : null,
	};
}

function parseContact(raw: unknown): Contact | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.name)) return null;

	return {
		id: raw.id,
		name: raw.name,
		phone: typeof raw.phone === "string" ? raw.phone : "",
		note: typeof raw.note === "string" ? raw.note : "",
		sourceId: nonEmptyString(raw.sourceId) ? raw.sourceId : null,
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
	};
}

function parseDebtPayment(raw: unknown): DebtPayment | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id)) return null;
	// A payment of nothing, or of an unreadable amount, would silently skew how
	// much of a debt is left — the one number the whole tab exists to report.
	if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null;
	if (raw.amount <= 0) return null;
	if (typeof raw.date !== "string" || !ISO_DATE.test(raw.date)) return null;

	return {
		id: raw.id,
		amount: raw.amount,
		date: raw.date,
		method: asPayMethod(raw.method),
		walletId: nonEmptyString(raw.walletId) ? raw.walletId : null,
		note: typeof raw.note === "string" ? raw.note : "",
		transactionId: nonEmptyString(raw.transactionId) ? raw.transactionId : null,
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
	};
}

function isDebtDirection(value: unknown): value is DebtDirection {
	return value === "borrowed" || value === "lent";
}

function parseDebt(raw: unknown): Debt | null {
	if (!isRecord(raw)) return null;
	if (!nonEmptyString(raw.id) || !nonEmptyString(raw.unit)) return null;
	if (!nonEmptyString(raw.contactId)) return null;
	if (!isDebtDirection(raw.direction)) return null;
	// Which way it runs and how much it was are the two things a debt cannot be
	// guessed back from, so either missing drops the record.
	if (typeof raw.amount !== "number" || !Number.isFinite(raw.amount)) return null;
	if (raw.amount <= 0) return null;
	if (typeof raw.date !== "string" || !ISO_DATE.test(raw.date)) return null;

	// A bad payment costs the debt its accuracy, not its existence — same trade
	// as a bad subcategory on a category.
	const payments = Array.isArray(raw.payments)
		? raw.payments.map(parseDebtPayment).filter((p): p is DebtPayment => p !== null)
		: [];

	return {
		id: raw.id,
		direction: raw.direction,
		contactId: raw.contactId,
		amount: raw.amount,
		unit: raw.unit,
		method: asPayMethod(raw.method),
		walletId: nonEmptyString(raw.walletId) ? raw.walletId : null,
		description: typeof raw.description === "string" ? raw.description : "",
		date: raw.date,
		dueDate:
			typeof raw.dueDate === "string" && ISO_DATE.test(raw.dueDate)
				? raw.dueDate
				: null,
		transactionId: nonEmptyString(raw.transactionId) ? raw.transactionId : null,
		payments,
		createdAt:
			typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
				? raw.createdAt
				: Date.now(),
	};
}

/**
 * Validates a backup file's text. Individual records that don't survive are
 * counted in `skipped` rather than failing the whole import: recovering most of
 * a damaged ledger beats recovering none of it.
 */
export function parseBackup(text: string): ParseResult {
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return { ok: false, error: "Fayl JSON formatida emas." };
	}

	if (!isRecord(raw)) return { ok: false, error: "Fayl mazmuni noto'g'ri." };
	if (raw.format !== BACKUP_FORMAT) {
		return { ok: false, error: "Bu Taqsim zaxira fayli emas." };
	}
	if (typeof raw.version !== "number" || raw.version > BACKUP_VERSION) {
		return {
			ok: false,
			error: "Fayl ilovaning yangiroq versiyasida yaratilgan. Ilovani yangilang.",
		};
	}
	if (!Array.isArray(raw.categories) || !Array.isArray(raw.transactions)) {
		return { ok: false, error: "Faylda kategoriya yoki yozuvlar ro'yxati yo'q." };
	}

	const categories = raw.categories
		.map(parseCategory)
		.filter((c): c is Category => c !== null);
	const transactions = raw.transactions
		.map(parseTransaction)
		.filter((t): t is Transaction => t !== null);

	// Both are absent from a version 1 file rather than malformed, so neither
	// counts towards `skipped`. A file with no wallets falls back to the starter
	// set: leaving a restored ledger with none would strand every entry's
	// allocation against wallets that don't exist.
	const rawWallets = Array.isArray(raw.wallets) ? raw.wallets : [];
	const parsedWallets = rawWallets
		.map(parseWallet)
		.filter((w): w is Wallet => w !== null);
	const wallets = parsedWallets.length > 0 ? parsedWallets : SEED_WALLETS;
	const transfers = Array.isArray(raw.transfers)
		? raw.transfers.map(parseTransfer).filter((t): t is Transfer => t !== null)
		: [];

	// Absent from any file below version 3, so like wallets they don't count as
	// damage — only records that were there and didn't survive do.
	const rawContacts = Array.isArray(raw.contacts) ? raw.contacts : [];
	const contacts = rawContacts
		.map(parseContact)
		.filter((c): c is Contact => c !== null);
	const rawDebts = Array.isArray(raw.debts) ? raw.debts : [];
	const debts = rawDebts.map(parseDebt).filter((d): d is Debt => d !== null);

	const skipped =
		raw.categories.length -
		categories.length +
		(raw.transactions.length - transactions.length) +
		(rawWallets.length - parsedWallets.length) +
		(rawContacts.length - contacts.length) +
		(rawDebts.length - debts.length);

	if (categories.length === 0 && transactions.length === 0) {
		return { ok: false, error: "Faylda tiklash uchun ma'lumot yo'q." };
	}

	return {
		ok: true,
		skipped,
		hasWallets: parsedWallets.length > 0,
		payload: {
			categories,
			transactions,
			wallets,
			transfers,
			contacts,
			debts,
			// An unknown code would leave every new entry in a currency that
			// doesn't exist; `unitByCode` falls back to the default.
			defaultUnit:
				typeof raw.defaultUnit === "string"
					? unitByCode(raw.defaultUnit).code
					: DEFAULT_UNIT,
		},
	};
}

/* Restoring --------------------------------------------------------------- */

/**
 * What a restore does with the wallets. "apply" brings the file's wallet
 * history in with it; "skip" keeps this device's wallets and lets the restored
 * history sit outside them.
 */
export type WalletRestoreMode = "apply" | "skip";

/**
 * Shapes a parsed backup for `replaceLedger` according to the user's choice.
 *
 * - "apply" with a file that has wallets: the file wins wholesale — its
 *   wallets, the splits each income recorded, its transfers. Splits are
 *   snapshots and are never recomputed here, for the same reason changing a
 *   percentage doesn't rewrite them.
 * - "apply" with a file that has none (older than wallets): the device's
 *   wallets stand in rather than the starter set, since they're the ones the
 *   user actually set up, and the history is split across them once.
 * - "skip": the device's wallets stay, and no restored entry touches them —
 *   income carries no split, expenses and debts name no wallet, transfers are
 *   dropped. Every jar starts from zero and fills from new income only; the
 *   wallets screen can still redistribute the history later if asked.
 *
 * Whenever the device's wallets are kept, a category also keeps how it feeds
 * them — its wallet mapping and split toggle belong to the wallet setup, not
 * to the history. A category the device doesn't have keeps only the mapping
 * to wallets that exist here.
 */
export function prepareRestore(
	payload: BackupPayload,
	hasWallets: boolean,
	mode: WalletRestoreMode,
	current: { wallets: Wallet[]; categories: Category[] },
): BackupPayload {
	if (mode === "apply" && hasWallets) return payload;

	const wallets = current.wallets;
	const walletIds = new Set(wallets.map((w) => w.id));
	const known = (id: string | null) => (id && walletIds.has(id) ? id : null);
	const mine = new Map(current.categories.map((c) => [c.id, c]));

	const categories = payload.categories.map((c) => {
		const own = mine.get(c.id);
		return own
			? { ...c, walletIds: own.walletIds ?? [], splitIncome: own.splitIncome }
			: { ...c, walletIds: (c.walletIds ?? []).filter((id) => walletIds.has(id)) };
	});

	if (mode === "apply") {
		// Only debt entries keep the wallet they named through `redistribute`,
		// and a file without wallets can't have named one of ours.
		const transactions = redistribute(payload.transactions, categories, wallets).map(
			(t) => ({ ...t, walletId: known(t.walletId) }),
		);
		return {
			...payload,
			wallets,
			categories,
			transactions,
			transfers: [],
			debts: payload.debts.map((d) => ({
				...d,
				walletId: known(d.walletId),
				payments: d.payments.map((p) => ({ ...p, walletId: known(p.walletId) })),
			})),
		};
	}

	return {
		...payload,
		wallets,
		categories,
		transactions: payload.transactions.map((t) => ({
			...t,
			allocations: [],
			walletId: null,
		})),
		transfers: [],
		debts: payload.debts.map((d) => ({
			...d,
			walletId: null,
			payments: d.payments.map((p) => ({ ...p, walletId: null })),
		})),
	};
}

/** Shared with lib/backupFile.ts, which recognises a cancelled picker. */
export function isErrorWithCode(value: unknown, code: string): boolean {
	return isRecord(value) && value.code === code;
}
