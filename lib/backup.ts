import { isCategoryColor } from "@/lib/categoryColors";
import { toISODate } from "@/lib/date";
import { DEFAULT_UNIT, unitByCode } from "@/lib/money";
import type {
	Category,
	IconName,
	Subcategory,
	Transaction,
	TxType,
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

/** Bump when the shape changes; `parseBackup` refuses anything newer. */
export const BACKUP_VERSION = 1;

/** The part of the ledger worth carrying between devices. */
export type BackupPayload = {
	categories: Category[];
	transactions: Transaction[];
	defaultUnit: string;
};

type BackupFile = BackupPayload & {
	format: typeof BACKUP_FORMAT;
	version: number;
	exportedAt: string;
};

export type ParseResult =
	| { ok: true; payload: BackupPayload; skipped: number }
	| { ok: false; error: string };

/* Writing ------------------------------------------------------------------ */

function pad(value: number): string {
	return `${value}`.padStart(2, "0");
}

/** Carries the clock as well as the day, so two exports never collide. */
export function backupFileName(now: Date = new Date()): string {
	const stamp = `${toISODate(now)}-${pad(now.getHours())}${pad(now.getMinutes())}`;
	return `kirciq-zaxira-${stamp}.json`;
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
		// These three are recoverable, so a miss costs the entry its label or its
		// place in the day's order — not the entry itself.
		subcategoryId: nonEmptyString(raw.subcategoryId) ? raw.subcategoryId : null,
		description: typeof raw.description === "string" ? raw.description : "",
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
		return { ok: false, error: "Bu Kirciq zaxira fayli emas." };
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
	const skipped =
		raw.categories.length -
		categories.length +
		(raw.transactions.length - transactions.length);

	if (categories.length === 0 && transactions.length === 0) {
		return { ok: false, error: "Faylda tiklash uchun ma'lumot yo'q." };
	}

	return {
		ok: true,
		skipped,
		payload: {
			categories,
			transactions,
			// An unknown code would leave every new entry in a currency that
			// doesn't exist; `unitByCode` falls back to the default.
			defaultUnit:
				typeof raw.defaultUnit === "string"
					? unitByCode(raw.defaultUnit).code
					: DEFAULT_UNIT,
		},
	};
}

/** Shared with lib/backupFile.ts, which recognises a cancelled picker. */
export function isErrorWithCode(value: unknown, code: string): boolean {
	return isRecord(value) && value.code === code;
}
