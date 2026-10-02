import type { IconName, PayMethod } from "@/lib/types";

/**
 * Amounts and their unit.
 *
 * Amounts are stored as plain numbers in whatever unit the transaction names —
 * there is no cross-currency conversion, so a total is only ever summed within
 * a single unit. `defaultUnit` (see LedgerContext) is what a new transaction
 * starts with.
 */

/**
 * How a transaction was paid.
 *
 * Card first, and the default for a new entry: a card payment leaves a trail
 * the user can check later, so it's the one they're most likely to be
 * reconciling against — and cash is the deliberate exception worth marking.
 */
export const PAY_METHODS: { key: PayMethod; label: string; icon: IconName }[] = [
	{ key: "card", label: "Karta", icon: "card-outline" },
	{ key: "cash", label: "Naqd", icon: "cash-outline" },
];

export const DEFAULT_METHOD: PayMethod = "card";

/**
 * Reads a stored or imported value as a payment method.
 *
 * Entries written before the field existed simply don't carry one, and they
 * far more often than not were card — so an absent value reads as card rather
 * than forcing every screen to handle a third, empty state.
 */
export function asPayMethod(value: unknown): PayMethod {
	return value === "cash" || value === "card" ? value : DEFAULT_METHOD;
}

export function methodByKey(method: PayMethod) {
	return PAY_METHODS.find((m) => m.key === method) ?? PAY_METHODS[0];
}

export type Unit = {
	code: string;
	symbol: string;
	name: string;
	position: "before" | "after";
	/** Decimal places kept when formatting. Som and tenge are used whole. */
	decimals: number;
};

export const UNITS: Unit[] = [
	{ code: "UZS", symbol: "so'm", name: "O'zbek so'mi", position: "after", decimals: 0 },
	{ code: "USD", symbol: "$", name: "AQSh dollari", position: "before", decimals: 2 },
	{ code: "EUR", symbol: "€", name: "Yevro", position: "before", decimals: 2 },
	{ code: "RUB", symbol: "₽", name: "Rossiya rubli", position: "after", decimals: 2 },
	{ code: "GBP", symbol: "£", name: "Funt sterling", position: "before", decimals: 2 },
	{ code: "KZT", symbol: "₸", name: "Qozog'iston tengesi", position: "after", decimals: 0 },
	{ code: "TRY", symbol: "₺", name: "Turk lirasi", position: "before", decimals: 2 },
	{ code: "AED", symbol: "AED", name: "BAA dirhami", position: "after", decimals: 2 },
];

export const DEFAULT_UNIT = "UZS";

export function unitByCode(code: string): Unit {
	return UNITS.find((u) => u.code === code) ?? UNITS[0];
}

/** "1234567.5" → "1 234 567.5" — narrow no-break spaces read better than commas
 *  for the large numbers a som balance runs to. */
function group(value: string): string {
	return value.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function formatAmount(
	amount: number,
	unitCode: string,
	options: { showUnit?: boolean; signed?: boolean } = {},
): string {
	const { showUnit = true, signed = false } = options;
	const unit = unitByCode(unitCode);
	const abs = Math.abs(amount);

	// Trailing zeros are noise on a list of round numbers, so a whole amount
	// drops them even where the unit normally carries decimals.
	const fixed = abs.toFixed(unit.decimals);
	const [whole, fraction] = fixed.split(".");
	const body =
		fraction && Number(fraction) !== 0
			? `${group(whole)}.${fraction}`
			: group(whole);

	const sign = signed && amount !== 0 ? (amount > 0 ? "+" : "−") : amount < 0 ? "−" : "";
	if (!showUnit) return `${sign}${body}`;

	return unit.position === "before"
		? `${sign}${unit.symbol}${body}`
		: `${sign}${body} ${unit.symbol}`;
}

/**
 * Placeholder standing in for a masked amount — same unit-symbol placement as
 * formatAmount, so hiding income doesn't reflow the surrounding layout.
 */
export function maskAmount(unitCode: string): string {
	const unit = unitByCode(unitCode);
	const dots = "••••";
	return unit.position === "before" ? `${unit.symbol}${dots}` : `${dots} ${unit.symbol}`;
}

/**
 * Snaps a value to the smallest unit its currency actually has.
 *
 * Repeated subtraction of user-entered amounts — a debt paid off in three
 * instalments, say — leaves float dust behind, and a remaining balance of
 * 0.0000000001 so'm would keep a settled debt forever open. Rounding at the
 * unit's own precision is the only reading that matches the money.
 */
export function roundAmount(amount: number, unitCode: string): number {
	if (!Number.isFinite(amount)) return 0;
	const factor = 10 ** unitByCode(unitCode).decimals;
	return Math.round(amount * factor) / factor;
}

/**
 * Parses what a user can actually type: a comma decimal separator, grouping
 * spaces, a stray currency symbol. Returns NaN for anything that isn't a
 * positive number, which is what the form validates on.
 */
export function parseAmount(input: string): number {
	const cleaned = input
		.replace(/[\s  ]/g, "")
		.replace(",", ".")
		.replace(/[^\d.]/g, "");
	if (!cleaned || cleaned === ".") return Number.NaN;
	return Number(cleaned);
}

/**
 * One key of the in-app number pad (components/ui/NumberPad), which is what
 * money amounts are typed with instead of the system keyboard.
 */
export type AmountKey =
	| "0"
	| "1"
	| "2"
	| "3"
	| "4"
	| "5"
	| "6"
	| "7"
	| "8"
	| "9"
	| "000"
	| "."
	| "back"
	| "clear";

/**
 * Twelve whole digits — hundreds of billions of so'm — is more than any entry
 * here will hold, and stopping there keeps the number well inside what a
 * double stores exactly.
 */
const MAX_WHOLE_DIGITS = 12;

/**
 * The amount text after one key press.
 *
 * The text stays in the plain shape parseAmount reads — digits and at most one
 * ".", no grouping — so a key that would make it malformed is simply ignored
 * rather than producing something the form then has to reject. `decimals` is
 * the unit's: a so'm amount has nowhere to put a point, and a dollar amount
 * stops at cents.
 */
export function pressAmountKey(text: string, key: AmountKey, decimals: number): string {
	switch (key) {
		case "clear":
			return "";
		case "back":
			return text.slice(0, -1);
		case "000": {
			let next = text;
			for (let i = 0; i < 3; i++) next = pressAmountKey(next, "0", decimals);
			return next;
		}
		case ".":
			if (decimals === 0 || text.includes(".")) return text;
			return `${text || "0"}.`;
	}

	const dot = text.indexOf(".");
	if (dot !== -1) return text.length - dot - 1 < decimals ? text + key : text;
	// A leading zero is replaced, never prefixed: "0" then "5" is 5, not 05.
	if (text === "0") return key;
	return text.length < MAX_WHOLE_DIGITS ? text + key : text;
}

/** "1500000.5" → "1 500 000.5" — amount text as it's shown while being typed. */
export function groupAmountText(text: string): string {
	const dot = text.indexOf(".");
	return dot === -1 ? group(text) : `${group(text.slice(0, dot))}${text.slice(dot)}`;
}
