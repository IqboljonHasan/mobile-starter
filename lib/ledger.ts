import type { Category, Debt, Transaction, TxType } from "@/lib/types";
import { formatFieldDate, monthKeyOf, shiftMonth, yearKeyOf } from "@/lib/date";
import { LEND_CATEGORY_ID, remainingAmount } from "@/lib/debts";
import { formatAmount } from "@/lib/money";
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

/**
 * The entries the income/expense totals count. With debts included that is all
 * of them. Without, debt movement stays out — except money lent and not yet
 * collected, which is gone from the user's pocket: the loan's own entry stays,
 * in the month it was lent, at what is still outstanding, shrinking as
 * collections come in and dropping out once the loan is settled. A lending
 * entry with no debt behind it has no collections to subtract, so it stays out
 * like the rest.
 */
export function countedForStats(
	transactions: Transaction[],
	debts: Debt[],
	{ includeDebts, uncollectedLoans }: { includeDebts: boolean; uncollectedLoans: boolean },
): Transaction[] {
	if (includeDebts) return transactions;
	if (!uncollectedLoans) return excludeDebts(transactions);
	const outstanding = new Map<string, number>();
	for (const debt of debts) {
		if (debt.direction === "lent" && debt.transactionId) {
			outstanding.set(debt.transactionId, remainingAmount(debt));
		}
	}
	return transactions.flatMap((t) => {
		if (!DEBT_CATEGORY_IDS.has(t.categoryId)) return [t];
		if (t.categoryId !== LEND_CATEGORY_ID) return [];
		const left = outstanding.get(t.id) ?? 0;
		return left > 0 ? [{ ...t, amount: Math.min(left, t.amount) }] : [];
	});
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

/**
 * What an entry looks like against its own kind — the same side, category and
 * subcategory (when it has one), in the same unit — for its detail screen.
 */
export type EntryContext = {
	/** Monthly totals of the kind, oldest first; the last is the entry's own month. */
	months: { monthKey: string; total: number; count: number }[];
	/** The mean of the months before the entry's, empty months included. */
	average: number;
	/** 0–1 of its month's total that this entry is. */
	share: number;
	/** The latest entries of the kind recorded before this one, newest first. */
	previous: Transaction[];
};

export function entryContext(
	transactions: Transaction[],
	entry: Transaction,
	span = 6,
	previousCount = 3,
): EntryContext {
	const kind = transactions.filter(
		(t) =>
			t.type === entry.type &&
			t.unit === entry.unit &&
			t.categoryId === entry.categoryId &&
			(!entry.subcategoryId || t.subcategoryId === entry.subcategoryId),
	);
	const last = monthKeyOf(entry.date);
	const months = Array.from({ length: span }, (_, i) => ({
		monthKey: shiftMonth(last, i - (span - 1)),
		total: 0,
		count: 0,
	}));
	const byKey = new Map(months.map((m) => [m.monthKey, m]));
	for (const t of kind) {
		const month = byKey.get(monthKeyOf(t.date));
		if (!month) continue;
		month.total += t.amount;
		month.count += 1;
	}
	const before = months.slice(0, -1);
	const current = months[months.length - 1];
	const earlier = (t: Transaction) =>
		t.date < entry.date || (t.date === entry.date && t.createdAt < entry.createdAt);

	return {
		months,
		average: before.length > 0 ? before.reduce((acc, m) => acc + m.total, 0) / before.length : 0,
		share: current.total > 0 ? Math.min(entry.amount / current.total, 1) : 1,
		previous: kind
			.filter((t) => t.id !== entry.id && earlier(t))
			.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
			.slice(0, previousCount),
	};
}

/** What "Ulashish" sends for one entry: what it was, how much, and when. */
export function entryShareMessage(entry: Transaction, title: string): string {
	return [
		`${entry.type === "income" ? "Kirim" : "Chiqim"}: ${title}`,
		formatAmount(entry.amount, entry.unit),
		formatFieldDate(entry.date),
		entry.description,
	]
		.filter(Boolean)
		.join("\n");
}
