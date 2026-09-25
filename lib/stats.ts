import { inMonth, inUnit, inYear, ofType, excludeDebts, sum } from "@/lib/ledger";
import type { Category, Transaction, TxType } from "@/lib/types";
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

/* Subcategories ------------------------------------------------------------ */

/** One row of the flat subcategory ranking. */
export type SubcategorySlice = {
	/** `categoryId:subcategoryId`, stable across periods — what a row is selected by. */
	key: string;
	categoryId: string;
	/** Null for the entries of a category filed under no subcategory. */
	subcategoryId: string | null;
	categoryName: string;
	/** The subcategory's name, or the category's own for its unfiled entries. */
	name: string;
	color: string;
	amount: number;
	/** 0–1 of the period's total for this type — the bar's length. */
	share: number;
	count: number;
};

const NONE = "__none__";

type Bucket = Omit<SubcategorySlice, "amount" | "share" | "count">;

/**
 * Which row an entry is counted under. An entry with no subcategory — or one
 * whose subcategory has since been deleted — stays under its category as an
 * unfiled row rather than vanishing, so the ranking still adds up to the
 * period's whole spend; a deleted category's entries gather into one
 * "Kategoriyasiz" row, the same as the category breakdown does.
 */
function bucketOf(t: Transaction, byId: Map<string, Category>): Bucket {
	const category = byId.get(t.categoryId);
	if (!category) {
		return {
			key: `${NONE}:${NONE}`,
			categoryId: NONE,
			subcategoryId: null,
			categoryName: "Kategoriyasiz",
			name: "Kategoriyasiz",
			color: "blue",
		};
	}
	const sub = t.subcategoryId
		? category.subcategories.find((s) => s.id === t.subcategoryId)
		: undefined;
	return {
		key: `${category.id}:${sub?.id ?? NONE}`,
		categoryId: category.id,
		subcategoryId: sub?.id ?? null,
		categoryName: category.name,
		name: sub?.name ?? category.name,
		color: sub?.color ?? category.color,
	};
}

/**
 * Spend (or income) per subcategory across every category, largest first —
 * the view that answers "what exactly is the money going on", which a
 * per-category total hides when one category holds both bread and furniture.
 * The caller scopes `transactions` to one unit, type, and period first.
 */
export function subcategoryBreakdown(
	transactions: Transaction[],
	categories: Category[],
): SubcategorySlice[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const rows = new Map<string, SubcategorySlice>();

	for (const t of transactions) {
		const bucket = bucketOf(t, byId);
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
 * One subcategory row's total per period, for its trend chart. The amount
 * lands on the side matching `type`, so the ordinary `BarChart` can draw it
 * as a single series. `transactions` is scoped by the caller the same way as
 * for `subcategoryBreakdown`, minus the period — this spans many.
 */
export function subcategoryTrend(
	transactions: Transaction[],
	categories: Category[],
	key: string,
	span: "month" | "year",
	periodKeys: string[],
	type: TxType,
): PeriodTotal[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const totals = new Map<string, number>();
	for (const t of transactions) {
		if (bucketOf(t, byId).key !== key) continue;
		const period = span === "month" ? monthKeyOf(t.date) : yearKeyOf(t.date);
		totals.set(period, (totals.get(period) ?? 0) + t.amount);
	}

	return periodKeys.map((period) => {
		const amount = totals.get(period) ?? 0;
		return {
			key: period,
			label: span === "month" ? monthShortLabel(period) : period,
			income: type === "income" ? amount : 0,
			expense: type === "expense" ? amount : 0,
		};
	});
}
