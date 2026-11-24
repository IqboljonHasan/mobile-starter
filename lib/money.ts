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
 * A figure cut down to fit a small tile — "9,3 mln", "932 ming", "$1,2 ming".
 * Rounded to one decimal at most, with the comma Uzbek writes decimals with.
 * Small amounts are shown in full, since there is nothing to shorten.
 */
export function formatCompact(amount: number, unitCode: string): string {
	const unit = unitByCode(unitCode);
	const abs = Math.abs(amount);
	const sign = amount < 0 ? "−" : "";
	const steps: [number, string][] = [
		[1e12, "trln"],
		[1e9, "mlrd"],
		[1e6, "mln"],
		[1e3, "ming"],
	];
	const step = steps.find(([size]) => abs >= size);
	if (!step) return formatAmount(amount, unitCode, { showUnit: unit.position === "before" });

	const [size, word] = step;
	const scaled = abs / size;
	// One decimal while it still says something ("9,3 mln"), none once the
	// whole part is long enough on its own ("932 ming").
	const body =
		scaled >= 100 ? String(Math.round(scaled)) : String(Math.round(scaled * 10) / 10).replace(".", ",");
	const symbol = unit.position === "before" ? unit.symbol : "";
	return `${sign}${symbol}${body} ${word}`;
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
 * Cuts a value down to the unit's own precision without rounding up — for a
 * figure on a small tile, where "9 320 000" must never read as more than the
 * wallet holds. Rounds first at a finer scale so float dust (1.1 * 3) doesn't
 * floor a whole number to one less.
 */
export function floorAmount(amount: number, unitCode: string): number {
	if (!Number.isFinite(amount)) return 0;
	const factor = 10 ** unitByCode(unitCode).decimals;
	return Math.floor(Math.round(amount * factor * 1e6) / 1e6) / factor;
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
 * An amount text together with where the caret sits in it. `caret` is an index
 * into the plain text (0 = before the first character, `text.length` = at the
 * end), never into the grouped text that is shown — grouping spaces come and go
 * as digits are typed, so a plain index is the one that stays put.
 */
export interface AmountEdit {
	text: string;
	caret: number;
}

/** True when `text` is a shape the form accepts: a bounded whole part and at most `decimals` places. */
function fitsAmount(text: string, decimals: number): boolean {
	const dot = text.indexOf(".");
	if (dot === -1) return text.length <= MAX_WHOLE_DIGITS;
	return dot <= MAX_WHOLE_DIGITS && text.length - dot - 1 <= decimals;
}

/**
 * Tidies the whole part after an edit and moves the caret with it: leading zeros
 * go ("05" is 5, never 05) and a bare ".5" gets its "0" back. The caret never
 * falls off the text it was in.
 */
function settleAmount(text: string, caret: number): AmountEdit {
	const dot = text.indexOf(".");
	const whole = dot === -1 ? text : text.slice(0, dot);
	const rest = dot === -1 ? "" : text.slice(dot);
	const trimmed = whole.length > 1 ? whole.replace(/^0+(?=\d)/, "") : whole;
	const dropped = whole.length - trimmed.length;
	let next = trimmed + rest;
	let at = Math.max(0, caret - dropped);
	if (trimmed === "" && rest) {
		next = `0${rest}`;
		at += 1;
	}
	return { text: next, caret: Math.min(at, next.length) };
}

/**
 * The amount and caret after one key press, edited at the caret rather than only
 * at the end.
 *
 * The text stays in the plain shape parseAmount reads — digits and at most one
 * ".", no grouping — so a key that would make it malformed is simply ignored
 * rather than producing something the form then has to reject. `decimals` is
 * the unit's: a so'm amount has nowhere to put a point, and a dollar amount
 * stops at cents. A key that changes nothing returns the very same edit, so
 * callers can tell by identity or by comparing the text.
 */
export function pressAmountKey(
	edit: AmountEdit,
	key: AmountKey,
	decimals: number,
): AmountEdit {
	const text = edit.text;
	const caret = Math.min(Math.max(edit.caret, 0), text.length);

	switch (key) {
		case "clear":
			return { text: "", caret: 0 };
		case "back": {
			if (caret === 0) return edit;
			const next = settleAmount(text.slice(0, caret - 1) + text.slice(caret), caret - 1);
			// Deleting the "." joins the places onto the whole part, which can
			// outgrow what a whole part may hold.
			return fitsAmount(next.text, decimals) ? next : edit;
		}
		case "000": {
			let next = edit;
			for (let i = 0; i < 3; i++) next = pressAmountKey(next, "0", decimals);
			return next;
		}
		case ".": {
			if (decimals === 0 || text.includes(".")) return edit;
			// Everything right of the point becomes places, so a point dropped
			// into the middle of a long number has to leave a legal tail.
			const next = settleAmount(`${text.slice(0, caret)}.${text.slice(caret)}`, caret + 1);
			return fitsAmount(next.text, decimals) ? next : edit;
		}
	}

	const next = settleAmount(text.slice(0, caret) + key + text.slice(caret), caret + 1);
	return fitsAmount(next.text, decimals) ? next : edit;
}

/** True for the characters groupAmountText inserts — the spaces between thousands. */
const isGrouping = (char: string) => /\s/.test(char);

/**
 * Where a plain-text caret lands in the grouped text that is on screen: the
 * same position, shifted right by every grouping space before it.
 */
export function caretToGrouped(text: string, caret: number): number {
	const grouped = groupAmountText(text);
	let plain = 0;
	for (let i = 0; i < grouped.length; i++) {
		if (plain === caret) return i;
		if (!isGrouping(grouped[i])) plain++;
	}
	return grouped.length;
}

/**
 * The reverse of caretToGrouped, for a caret the user placed by tapping the
 * grouped text. A tap that lands beside a grouping space counts as the digit
 * on its left, so the caret never rests "inside" a space.
 */
export function caretFromGrouped(text: string, groupedCaret: number): number {
	const grouped = groupAmountText(text);
	let plain = 0;
	for (let i = 0; i < Math.min(groupedCaret, grouped.length); i++) {
		if (!isGrouping(grouped[i])) plain++;
	}
	return plain;
}

/** "1500000.5" → "1 500 000.5" — amount text as it's shown while being typed. */
export function groupAmountText(text: string): string {
	const dot = text.indexOf(".");
	return dot === -1 ? group(text) : `${group(text.slice(0, dot))}${text.slice(dot)}`;
}
