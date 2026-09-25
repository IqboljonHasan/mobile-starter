import { inMonth, inUnit, inYear, ofType, excludeDebts, sum } from "@/lib/ledger";
import type { Transaction } from "@/lib/types";
import { monthShortLabel } from "@/lib/date";

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
