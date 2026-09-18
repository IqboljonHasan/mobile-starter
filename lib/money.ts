/**
 * Amounts and their unit.
 *
 * Amounts are stored as plain numbers in whatever unit the transaction names —
 * there is no cross-currency conversion, so a total is only ever summed within
 * a single unit. `defaultUnit` (see LedgerContext) is what a new transaction
 * starts with.
 */

export type Unit = {
	code: string;
	symbol: string;
	name: string;
	position: "before" | "after";
	/** Decimal places kept when formatting. Som and tenge are used whole. */
	decimals: number;
};

export const UNITS: Unit[] = [
	{ code: "UZS", symbol: "so'm", name: "Uzbek som", position: "after", decimals: 0 },
	{ code: "USD", symbol: "$", name: "US dollar", position: "before", decimals: 2 },
	{ code: "EUR", symbol: "€", name: "Euro", position: "before", decimals: 2 },
	{ code: "RUB", symbol: "₽", name: "Russian ruble", position: "after", decimals: 2 },
	{ code: "GBP", symbol: "£", name: "Pound sterling", position: "before", decimals: 2 },
	{ code: "KZT", symbol: "₸", name: "Kazakh tenge", position: "after", decimals: 0 },
	{ code: "TRY", symbol: "₺", name: "Turkish lira", position: "before", decimals: 2 },
	{ code: "AED", symbol: "AED", name: "UAE dirham", position: "after", decimals: 2 },
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
