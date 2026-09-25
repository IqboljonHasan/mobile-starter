import { inMonth, inUnit, inYear, ofType, excludeDebts, sum } from "@/lib/ledger";
import type { Category, Transaction } from "@/lib/types";
import { categoryColorValue } from "@/lib/categoryColors";
import { monthKeyOf, monthShortLabel, yearKeyOf } from "@/lib/date";

/**
 * Pure aggregation helpers for the stats screen's trend charts. Nothing here
 * touches storage or React, matching lib/ledger.ts — this file only exists
 * separately because it groups transactions by a *span of periods* (a trailing
 * year of months, a trailing run of years) rather than by one period at a
 * time, which lib/ledger.ts's helpers already cover.
 *
 * Every total here is scoped to one unit by the caller first, for the same
 * reason as everywhere else: a bar chart that silently added som to dollars
 * would plot a number that means nothing.
 */

export type PeriodTotal = {
	key: string;
	/** Short axis label — a month's three-letter name, or a year's four digits. */
	label: string;
	income: number;
	expense: number;
};

/** How many trailing months/years a trend chart plots. */
export const TREND_MONTHS = 12;
export const TREND_YEARS = 6;

/**
 * Income and expense per period, in one unit. Debt categories are excluded
 * unless the caller says otherwise — the same default every other stat in the
 * app uses, so a trend chart doesn't disagree with the dashboard about what
 * counts as income.
 */
function totalsOf(transactions: Transaction[], includeDebts: boolean): { income: number; expense: number } {
	const relevant = includeDebts ? transactions : excludeDebts(transactions);
	return {
		income: sum(ofType(relevant, "income")),
		expense: sum(ofType(relevant, "expense")),
	};
}

/** One bar-group per month in `monthKeys`, in the order given. */
export function monthlyTotals(
	transactions: Transaction[],
	monthKeys: string[],
	unit: string,
	includeDebts: boolean,
): PeriodTotal[] {
	const scoped = inUnit(transactions, unit);
	return monthKeys.map((key) => ({
		key,
		label: monthShortLabel(key),
		...totalsOf(inMonth(scoped, key), includeDebts),
	}));
}

/** One bar-group per year in `yearKeys`, in the order given. */
export function yearlyTotals(
	transactions: Transaction[],
	yearKeys: string[],
	unit: string,
	includeDebts: boolean,
): PeriodTotal[] {
	const scoped = inUnit(transactions, unit);
	return yearKeys.map((key) => ({
		key,
		label: key,
		...totalsOf(inYear(scoped, key), includeDebts),
	}));
}

/* Breakdowns --------------------------------------------------------------- */

/** How finely a breakdown groups entries. */
export type BreakdownLevel = "category" | "subcategory";

/** How a breakdown card draws itself. Remembered per card — see PreferencesContext. */
export type ChartKind = "trend" | "bar" | "pie";

/** One row of a breakdown, at either level. */
export type StatSlice = {
	/**
	 * Stable across periods — what a row is selected by. A category's id, or
	 * `categoryId:subcategoryId` at the subcategory level.
	 */
	key: string;
	name: string;
	/**
	 * A second line for the row: the parent category's name for a
	 * subcategory, "subkategoriyasiz" for a category's unfiled entries, and
	 * null at the category level, where the name says it all.
	 */
	context: string | null;
	color: string;
	amount: number;
	/** 0–1 of the period's total for this type — the bar's length. */
	share: number;
	count: number;
};

const NONE = "__none__";
/** The folded tail of a breakdown. Drawn in a neutral tone, never a category's. */
export const OTHER_KEY = "__other__";

/**
 * A row's drawn color. The folded tail takes `neutral` (the theme's muted
 * foreground) rather than a palette color, so it can't be mistaken for a real
 * category that happens to share its hue.
 */
export function sliceColor(
	key: string,
	color: string,
	isDark: boolean,
	neutral: string,
): string {
	return key === OTHER_KEY ? neutral : categoryColorValue(color, isDark);
}

type Bucket = Omit<StatSlice, "amount" | "share" | "count">;

/**
 * Which row an entry is counted under. At the subcategory level an entry with
 * no subcategory — or one whose subcategory has since been deleted — stays
 * under its category as an unfiled row rather than vanishing, so the rows
 * still add up to the period's whole total. A deleted category's entries
 * gather into one "Kategoriyasiz" row at either level.
 */
function bucketOf(
	t: Transaction,
	byId: Map<string, Category>,
	level: BreakdownLevel,
): Bucket {
	const category = byId.get(t.categoryId);
	if (!category) {
		return { key: NONE, name: "Kategoriyasiz", context: null, color: "blue" };
	}
	if (level === "category") {
		return { key: category.id, name: category.name, context: null, color: category.color };
	}
	const sub = t.subcategoryId
		? category.subcategories.find((s) => s.id === t.subcategoryId)
		: undefined;
	return {
		key: `${category.id}:${sub?.id ?? NONE}`,
		name: sub?.name ?? category.name,
		context: sub ? category.name : "subkategoriyasiz",
		color: sub?.color ?? category.color,
	};
}

/**
 * Total per category or per subcategory, largest first. At the subcategory
 * level the list is flat across every category, so "Taksi" and "Non" compete
 * directly instead of each hiding inside its category's total. The caller
 * scopes `transactions` to one unit, type, and period first.
 */
export function breakdown(
	transactions: Transaction[],
	categories: Category[],
	level: BreakdownLevel,
): StatSlice[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const rows = new Map<string, StatSlice>();

	for (const t of transactions) {
		const bucket = bucketOf(t, byId, level);
		const row = rows.get(bucket.key) ?? { ...bucket, amount: 0, share: 0, count: 0 };
		row.amount += t.amount;
		row.count += 1;
		rows.set(bucket.key, row);
	}

	const total = sum(transactions);
	return [...rows.values()]
		.map((row) => ({ ...row, share: total > 0 ? row.amount / total : 0 }))
		.sort((a, b) => b.amount - a.amount);
}

/**
 * Folds every slice past the first `maxRows` into one "Boshqa" slice rather
 * than dropping them, so a chart's slices still add up to the period's total.
 */
export function foldSlices(slices: StatSlice[], maxRows: number): StatSlice[] {
	const head = slices.slice(0, maxRows);
	const tail = slices.slice(maxRows);
	if (tail.length === 0) return head;

	return [
		...head,
		{
			key: OTHER_KEY,
			name: `Boshqa (${tail.length})`,
			context: null,
			color: "blue",
			amount: tail.reduce((acc, s) => acc + s.amount, 0),
			share: tail.reduce((acc, s) => acc + s.share, 0),
			count: tail.reduce((acc, s) => acc + s.count, 0),
		},
	];
}

/** One period of a stacked trend: a segment per tracked row, in rank order. */
export type StackedPeriod = {
	key: string;
	label: string;
	segments: { key: string; amount: number }[];
	total: number;
};

/**
 * Each tracked row's total per period, for a stacked trend chart. Rows not in
 * `keys` are summed into one `OTHER_KEY` segment when `withOther` is set —
 * so a stack still reaches the period's real total — or left out when the
 * chart is about the tracked rows alone. `transactions` is scoped by the
 * caller the same way as for `breakdown`, minus the period: this spans many.
 */
export function stackedTrend(
	transactions: Transaction[],
	categories: Category[],
	level: BreakdownLevel,
	span: "month" | "year",
	periodKeys: string[],
	keys: string[],
	withOther: boolean,
): StackedPeriod[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const tracked = new Set(keys);
	const totals = new Map<string, Map<string, number>>();

	for (const t of transactions) {
		const bucket = bucketOf(t, byId, level).key;
		const segment = tracked.has(bucket) ? bucket : withOther ? OTHER_KEY : null;
		if (!segment) continue;
		const period = span === "month" ? monthKeyOf(t.date) : yearKeyOf(t.date);
		const row = totals.get(period) ?? new Map<string, number>();
		row.set(segment, (row.get(segment) ?? 0) + t.amount);
		totals.set(period, row);
	}

	const order = withOther ? [...keys, OTHER_KEY] : keys;
	return periodKeys.map((period) => {
		const row = totals.get(period);
		const segments = order.map((key) => ({ key, amount: row?.get(key) ?? 0 }));
		return {
			key: period,
			label: span === "month" ? monthShortLabel(period) : period,
			segments,
			total: segments.reduce((acc, s) => acc + s.amount, 0),
		};
	});
}
