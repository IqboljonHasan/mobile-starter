import type { Category, Transaction, TxType } from "@/lib/types";
import { monthKeyOf, yearKeyOf } from "@/lib/date";
import { DEBT_CATEGORY_IDS } from "@/lib/seed";

/**
 * Pure read-side helpers over the ledger. Nothing here touches storage or
 * React — screens call these on the arrays the LedgerContext hands them.
 *
 * Amounts are never summed across units: an app that adds som to dollars
 * reports a number that means nothing. Every total here is either scoped to one
 * unit by the caller or returned broken down by unit.
 */

export type UnitTotal = { unit: string; amount: number };

export function inMonth(transactions: Transaction[], monthKey: string): Transaction[] {
	return transactions.filter((t) => monthKeyOf(t.date) === monthKey);
}

export function inYear(transactions: Transaction[], yearKey: string): Transaction[] {
	return transactions.filter((t) => yearKeyOf(t.date) === yearKey);
}

export function ofType(transactions: Transaction[], type: TxType): Transaction[] {
	return transactions.filter((t) => t.type === type);
}

/** Drops transactions filed under a debt category — see DEBT_CATEGORY_IDS in
 *  lib/seed.ts. Used to keep debt movement out of income/expense stats. */
export function excludeDebts(transactions: Transaction[]): Transaction[] {
	return transactions.filter((t) => !DEBT_CATEGORY_IDS.has(t.categoryId));
}

export function inUnit(transactions: Transaction[], unit: string | null): Transaction[] {
	return unit ? transactions.filter((t) => t.unit === unit) : transactions;
}

export function sum(transactions: Transaction[]): number {
	return transactions.reduce((acc, t) => acc + t.amount, 0);
}

/** Totals per unit, largest first — the safe way to total a mixed list. */
export function sumByUnit(transactions: Transaction[]): UnitTotal[] {
	const totals = new Map<string, number>();
	for (const t of transactions) {
		totals.set(t.unit, (totals.get(t.unit) ?? 0) + t.amount);
	}
	return [...totals.entries()]
		.map(([unit, amount]) => ({ unit, amount }))
		.sort((a, b) => b.amount - a.amount);
}

export type MethodTotals = { cash: number; card: number };

/**
 * Splits a list by how the money moved. Scope the list to one unit first —
 * like every other total here, these must not mix currencies.
 */
export function sumByMethod(transactions: Transaction[]): MethodTotals {
	const totals: MethodTotals = { cash: 0, card: 0 };
	for (const t of transactions) {
		// Tested against "cash" rather than indexed by the field, so an entry
		// carrying something unexpected lands on card instead of turning the
		// whole total into NaN.
		if (t.method === "cash") totals.cash += t.amount;
		else totals.card += t.amount;
	}
	return totals;
}

/** Units present in a set of transactions, busiest first. */
export function unitsUsed(transactions: Transaction[]): string[] {
	return sumByUnit(transactions).map((t) => t.unit);
}

export type CategorySlice = {
	categoryId: string;
	name: string;
	color: string;
	amount: number;
	/** 0–1 of the period's total for this type — the bar's length. */
	share: number;
	count: number;
};

/**
 * Spend (or income) per category, largest first. Transactions whose category
 * has since been deleted fall into one "Kategoriyasiz" slice rather than
 * disappearing from the total.
 */
export function categoryBreakdown(
	transactions: Transaction[],
	categories: Category[],
): CategorySlice[] {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const buckets = new Map<string, { amount: number; count: number }>();

	for (const t of transactions) {
		const key = byId.has(t.categoryId) ? t.categoryId : "__none__";
		const bucket = buckets.get(key) ?? { amount: 0, count: 0 };
		bucket.amount += t.amount;
		bucket.count += 1;
		buckets.set(key, bucket);
	}

	const total = sum(transactions);
	return [...buckets.entries()]
		.map(([categoryId, { amount, count }]) => {
			const category = byId.get(categoryId);
			return {
				categoryId,
				name: category?.name ?? "Kategoriyasiz",
				color: category?.color ?? "blue",
				amount,
				share: total > 0 ? amount / total : 0,
				count,
			};
		})
		.sort((a, b) => b.amount - a.amount);
}

/**
 * Folds every slice past the first `maxRows` into one "Boshqa" (other) slice,
 * rather than dropping them — so a chart's slices still add up to the whole
 * period's total. Shared by `CategoryBreakdown`'s list and the stats screen's
 * pie chart, so the two never disagree about which categories are "the small
 * ones" this period.
 */
export function foldCategorySlices(
	slices: CategorySlice[],
	maxRows = 6,
): CategorySlice[] {
	const head = slices.slice(0, maxRows);
	const tail = slices.slice(maxRows);
	if (tail.length === 0) return head;

	return [
		...head,
		{
			categoryId: "__other__",
			name: `Boshqa (${tail.length})`,
			color: "blue",
			amount: tail.reduce((acc, s) => acc + s.amount, 0),
			share: tail.reduce((acc, s) => acc + s.share, 0),
			count: tail.reduce((acc, s) => acc + s.count, 0),
		},
	];
}

export type DaySection = {
	/** "YYYY-MM-DD" */
	title: string;
	totals: UnitTotal[];
	data: Transaction[];
};

/**
 * Newest day first, and newest entry first within a day — the order a ledger is
 * read in. `createdAt` breaks ties so two entries on the same day keep the order
 * they were added.
 */
export function groupByDay(transactions: Transaction[]): DaySection[] {
	const days = new Map<string, Transaction[]>();
	for (const t of transactions) {
		const list = days.get(t.date);
		if (list) list.push(t);
		else days.set(t.date, [t]);
	}

	return [...days.entries()]
		.sort(([a], [b]) => (a < b ? 1 : -1))
		.map(([title, items]) => ({
			title,
			totals: sumByUnit(items),
			data: [...items].sort((a, b) => b.createdAt - a.createdAt),
		}));
}

/** The category and subcategory a transaction points at, if they still exist. */
export function resolveCategory(transaction: Transaction, categories: Category[]) {
	const category = categories.find((c) => c.id === transaction.categoryId) ?? null;
	const subcategory =
		category?.subcategories.find((s) => s.id === transaction.subcategoryId) ?? null;
	return { category, subcategory };
}

export function countUsage(transactions: Transaction[], categoryId: string): number {
	return transactions.filter((t) => t.categoryId === categoryId).length;
}

export function countSubUsage(transactions: Transaction[], subcategoryId: string): number {
	return transactions.filter((t) => t.subcategoryId === subcategoryId).length;
}
