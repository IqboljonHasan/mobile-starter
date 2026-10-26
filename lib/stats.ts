import type { Category, IconName, Transaction, Wallet } from "@/lib/types";
import {
	daysBetween,
	daysInMonth,
	monthKeyOf,
	monthName,
	monthShortLabel,
	monthTitle,
	shiftMonth,
	todayISO,
	yearKeyOf,
} from "@/lib/date";
import { UNALLOCATED_ID, UNALLOCATED_NAME, walletShare } from "@/lib/wallets";

/**
 * Pure aggregation for the Tahlil screen. Nothing here touches storage or
 * React, matching lib/ledger.ts — this file only exists separately because it
 * works across *several periods* (a month's weeks, a year's months, the whole
 * ledger's quarters) and sets a period against the one before it, where
 * lib/ledger.ts covers one period at a time.
 *
 * Every total here is scoped to one unit by the caller first, for the same
 * reason as everywhere else: a chart that silently added som to dollars would
 * plot a number that means nothing.
 */

/** What the screen is scoped to: one month, one year, or everything. */
export type Span = "month" | "year" | "all";

/** How a chart draws itself. Remembered per chart — see PreferencesContext. */
export type ChartKind = "line" | "bar";

/** What the composition groups an entry by. */
export type Dimension = "category" | "subcategory" | "wallet";

/** A row opened up into what it's made of: a category into its
 *  subcategories, a wallet into the categories that went through it. */
export type Drill = { kind: "category" | "wallet"; id: string };

/** A run of calendar days, both ends included. */
export type Window = { from: string; to: string };

const pad2 = (n: number) => `${n}`.padStart(2, "0");

function monthWindow(monthKey: string): Window {
	return { from: `${monthKey}-01`, to: `${monthKey}-${pad2(daysInMonth(monthKey))}` };
}

function yearWindow(yearKey: string): Window {
	return { from: `${yearKey}-01-01`, to: `${yearKey}-12-31` };
}

function inWindow(date: string, window: Window): boolean {
	return date >= window.from && date <= window.to;
}

/* Periods ------------------------------------------------------------------ */

/**
 * How far the ledger reaches: from its first entry (or today, for an empty
 * one) to today — or to a later entry's day, since an entry can be planned
 * ahead. "Butun davr" is this window, and the period arrows stop at its ends:
 * a month before the first entry has nothing to show.
 */
export function ledgerWindow(transactions: Transaction[], today: string = todayISO()): Window {
	let from = today;
	let to = today;
	for (const t of transactions) {
		if (t.date < from) from = t.date;
		if (t.date > to) to = t.date;
	}
	return { from, to };
}

/** The days a month, a year, or the whole ledger covers. */
export function periodWindow(span: Span, key: string, ledger: Window): Window {
	if (span === "month") return monthWindow(key);
	if (span === "year") return yearWindow(key);
	return ledger;
}

/**
 * What a month or a year is set against: the one before it — and while the
 * period is still running, only as much of the one before as has passed of
 * this one. Three days into a month it is set against the first three days of
 * the last one rather than all of it, or every month would look cheap until
 * it ended.
 */
export type Comparison = {
	/** The part of the period being compared — up to today while it runs. */
	current: Window;
	previous: Window;
	/** "sentabrga nisbatan", "sentabrning shu davriga nisbatan". */
	label: string;
};

/** `today`'s place in the period before — the same day of the previous month
 *  or year, pulled back to that month's last day when it has fewer. */
function sameDayBefore(span: "month" | "year", today: string): string {
	const month =
		span === "month"
			? shiftMonth(monthKeyOf(today), -1)
			: `${Number(yearKeyOf(today)) - 1}-${today.slice(5, 7)}`;
	return `${month}-${pad2(Math.min(Number(today.slice(8, 10)), daysInMonth(month)))}`;
}

/**
 * Null for the whole ledger, which has nothing before it — and until the
 * ledger covers the whole of the period before: a year set against the five
 * months someone had been using the app the year before would read as a
 * fourfold jump that never happened.
 */
export function comparisonOf(
	span: Span,
	key: string,
	ledger: Window,
	today: string = todayISO(),
): Comparison | null {
	if (span === "all") return null;
	const window = span === "month" ? monthWindow(key) : yearWindow(key);
	const previousKey = span === "month" ? shiftMonth(key, -1) : `${Number(key) - 1}`;
	const previous = span === "month" ? monthWindow(previousKey) : yearWindow(previousKey);
	if (ledger.from > previous.from) return null;

	const running = inWindow(today, window);
	const name = span === "month" ? monthName(previousKey).toLowerCase() : `${previousKey}-yil`;
	return {
		current: { from: window.from, to: running ? today : window.to },
		previous: { from: previous.from, to: running ? sameDayBefore(span, today) : previous.to },
		label: running ? `${name}ning shu davriga nisbatan` : `${name}ga nisbatan`,
	};
}

/** How far `current` moved from `previous`, as a fraction — 0.12 is 12% more.
 *  Null when there was nothing before to measure against. */
export function change(current: number, previous: number): number | null {
	return previous !== 0 ? (current - previous) / Math.abs(previous) : null;
}

export type Flow = { income: number; expense: number };

/** What came in and went out over a window. */
export function flowIn(transactions: Transaction[], window: Window): Flow {
	let income = 0;
	let expense = 0;
	for (const t of transactions) {
		if (!inWindow(t.date, window)) continue;
		if (t.type === "income") income += t.amount;
		else expense += t.amount;
	}
	return { income, expense };
}

/* Columns ------------------------------------------------------------------ */

/** One column of a chart: a week, a month, a quarter, or a year. */
export type Column = {
	key: string;
	/** Under the column. */
	label: string;
	/** A smaller second line: the year a run of months or quarters enters, or
	 *  the months a year column was cut down to. */
	sublabel: string | null;
	/** Spelled out, for a detail box and for screen readers. */
	title: string;
	window: Window;
	/** A month or year column can be set against the one before it. */
	period: { span: "month" | "year"; key: string } | null;
	/** What one of these is called — "Eng qimmat hafta". */
	unit: "hafta" | "oy" | "chorak" | "yil";
};

/** The most quarters "Butun davr" splits into before it falls back to years. */
const MAX_QUARTERS = 12;

const QUARTERS = ["I", "II", "III", "IV"];

function monthsFrom(first: string, last: string): string[] {
	const keys: string[] = [];
	for (let key = first; key <= last; key = shiftMonth(key, 1)) keys.push(key);
	return keys;
}

/** "apr–dek" — the months a cut-short quarter or year actually spans. */
function monthSpan(months: string[]): string {
	const first = monthShortLabel(months[0]);
	return months.length > 1 ? `${first}–${monthShortLabel(months[months.length - 1])}` : first;
}

/** A month's weeks as days 1–7, 8–14, 15–21, 22–28, and whatever is left. */
function weekColumns(monthKey: string): Column[] {
	const last = daysInMonth(monthKey);
	const name = monthName(monthKey).toLowerCase();
	const columns: Column[] = [];
	for (let first = 1; first <= last; first += 7) {
		const end = last - first < 7 ? last : first + 6;
		columns.push({
			key: `${monthKey}-w${first}`,
			label: `${first}–${end}`,
			sublabel: null,
			title: `${first}–${end} ${name}`,
			window: { from: `${monthKey}-${pad2(first)}`, to: `${monthKey}-${pad2(end)}` },
			period: null,
			unit: "hafta",
		});
	}
	return columns;
}

/** One column per month from `first` to `last`, the year written under the
 *  first column and under every January after it. */
function monthColumns(first: string, last: string, yearMarks: boolean): Column[] {
	return monthsFrom(first, last).map((key, i) => ({
		key,
		label: monthShortLabel(key),
		sublabel: yearMarks && (i === 0 || key.endsWith("-01")) ? yearKeyOf(key) : null,
		title: monthTitle(key),
		window: monthWindow(key),
		period: { span: "month", key },
		unit: "oy",
	}));
}

function quarterColumns(first: string, last: string): Column[] {
	const groups: { year: string; quarter: number; months: string[] }[] = [];
	for (const key of monthsFrom(first, last)) {
		const year = yearKeyOf(key);
		const quarter = Math.floor((Number(key.slice(5, 7)) - 1) / 3);
		const group = groups[groups.length - 1];
		if (group && group.year === year && group.quarter === quarter) group.months.push(key);
		else groups.push({ year, quarter, months: [key] });
	}
	return groups.map(({ year, quarter, months }, i) => {
		// A quarter the ledger only partly reaches is named by its months, so
		// its short column doesn't pass for a whole quarter.
		const partial = months.length < 3 ? monthSpan(months) : null;
		return {
			key: `${year}-q${quarter + 1}`,
			label: partial ?? QUARTERS[quarter],
			sublabel: i === 0 || groups[i - 1].year !== year ? year : null,
			title: `${year} · ${partial ?? `${QUARTERS[quarter]} chorak`}`,
			window: { from: monthWindow(months[0]).from, to: monthWindow(months[months.length - 1]).to },
			period: null,
			unit: "chorak",
		};
	});
}

function yearColumns(first: string, last: string): Column[] {
	const columns: Column[] = [];
	for (let year = Number(yearKeyOf(first)); year <= Number(yearKeyOf(last)); year++) {
		const key = String(year);
		const months = monthsFrom(
			first > `${key}-01` ? first : `${key}-01`,
			last < `${key}-12` ? last : `${key}-12`,
		);
		const partial = months.length < 12 ? monthSpan(months) : null;
		columns.push({
			key,
			label: key,
			sublabel: partial,
			title: partial ? `${key} yil (${partial})` : `${key} yil`,
			window: { from: monthWindow(months[0]).from, to: monthWindow(months[months.length - 1]).to },
			period: { span: "year", key },
			unit: "yil",
		});
	}
	return columns;
}

/** The months of `yearKey` the ledger reaches — a year it began or ends in
 *  is cut to those months rather than padded with empty ones. */
function monthsOfYearInLedger(yearKey: string, ledger: Window): [string, string] {
	const first = monthKeyOf(ledger.from) > `${yearKey}-01` ? monthKeyOf(ledger.from) : `${yearKey}-01`;
	const last = monthKeyOf(ledger.to) < `${yearKey}-12` ? monthKeyOf(ledger.to) : `${yearKey}-12`;
	return first <= last ? [first, last] : [`${yearKey}-01`, `${yearKey}-12`];
}

/**
 * The columns the composition splits its period into: a month's weeks, a
 * year's months, or the whole ledger's quarters — its years, once there are
 * too many quarters to tell apart.
 */
export function compositionColumns(span: Span, key: string, ledger: Window): Column[] {
	if (span === "month") return weekColumns(key);
	if (span === "year") {
		const [first, last] = monthsOfYearInLedger(key, ledger);
		return monthColumns(first, last, false);
	}
	const first = monthKeyOf(ledger.from);
	const last = monthKeyOf(ledger.to);
	const quarters = quarterColumns(first, last);
	return quarters.length <= MAX_QUARTERS ? quarters : yearColumns(first, last);
}

/**
 * The columns of the income-vs-expense run. Unlike the composition it isn't
 * cut to the period: for a month it runs over every month the ledger has, so
 * the picked month is seen among its neighbours and a column picks another.
 * A year shows its own months, and the whole ledger its years.
 */
export function flowColumns(span: Span, key: string, ledger: Window): Column[] {
	if (span === "month") {
		return monthColumns(monthKeyOf(ledger.from), monthKeyOf(ledger.to), true);
	}
	if (span === "year") {
		const [first, last] = monthsOfYearInLedger(key, ledger);
		return monthColumns(first, last, false);
	}
	return yearColumns(monthKeyOf(ledger.from), monthKeyOf(ledger.to));
}

/** Which column a day falls in, or -1. Columns are in order and don't overlap. */
function columnOf(columns: Column[], date: string): number {
	let low = 0;
	let high = columns.length - 1;
	while (low <= high) {
		const mid = (low + high) >> 1;
		const { window } = columns[mid];
		if (date < window.from) high = mid - 1;
		else if (date > window.to) low = mid + 1;
		else return mid;
	}
	return -1;
}

/** Income and expense per column. */
export function flowByColumn(transactions: Transaction[], columns: Column[]): Flow[] {
	const flows = columns.map(() => ({ income: 0, expense: 0 }));
	for (const t of transactions) {
		const i = columnOf(columns, t.date);
		if (i < 0) continue;
		if (t.type === "income") flows[i].income += t.amount;
		else flows[i].expense += t.amount;
	}
	return flows;
}

/* Composition -------------------------------------------------------------- */

/** The folded tail of a chart's series. Drawn in a neutral tone, never a
 *  category's, so it can't be mistaken for one that shares its hue. */
export const OTHER_KEY = "__other__";
const NONE = "__none__";

/** What a breakdown is looking at: a grouping, or one row opened up. */
export type Lens = { dimension: Dimension; drill: Drill | null };

/** One ranked line of a breakdown. */
export type Row = {
	key: string;
	name: string;
	/** A dimmer second line — a subcategory's category, say. */
	context: string | null;
	/** A wallet is drawn as its own tile; everything else as a category. */
	kind: "category" | "wallet";
	/** Palette key, or null for a row with no hue of its own. */
	color: string | null;
	icon: IconName | null;
	amount: number;
	/** 0–1 of the period's total. */
	share: number;
	/** The same row over the comparison's previous window — null without one. */
	previous: number | null;
	/** Against `previous`, the same way the total moves. */
	change: number | null;
	/** What tapping it opens, or null when there's nothing inside. */
	drill: Drill | null;
};

/** A line on the chart — one of the biggest rows, or the folded rest. */
export type Series = { key: string; name: string; color: string | null };

export type Composition = {
	/** Every row, largest first. */
	rows: Row[];
	total: number;
	/** The total against the comparison's previous window. */
	change: number | null;
	/** The biggest rows, and when there are more, the rest folded into one. */
	series: Series[];
	/** Each column's amount per series key. */
	columns: Record<string, number>[];
};

type Part = { key: string; amount: number };

/**
 * The pieces an entry counts as. Most entries are one piece; an income split
 * across wallets is one per wallet, so the wallets still add up to the total.
 * A deleted category's entries gather under one "Kategoriyasiz" row, and an
 * entry whose subcategory is gone stays under its category as unfiled — the
 * rows always add up to the period's whole total.
 */
function partsOf(t: Transaction, lens: Lens, byId: Map<string, Category>): Part[] {
	const category = byId.get(t.categoryId);
	const categoryKey = category ? category.id : NONE;
	const subKey = () => {
		const sub = category?.subcategories.find((s) => s.id === t.subcategoryId);
		return `${categoryKey}:${sub ? sub.id : NONE}`;
	};

	if (lens.drill?.kind === "category") {
		return categoryKey === lens.drill.id ? [{ key: subKey(), amount: t.amount }] : [];
	}
	if (lens.drill?.kind === "wallet") {
		const share = walletShare(t, lens.drill.id);
		return share > 0 ? [{ key: categoryKey, amount: share }] : [];
	}
	if (lens.dimension === "category") return [{ key: categoryKey, amount: t.amount }];
	if (lens.dimension === "subcategory") return [{ key: subKey(), amount: t.amount }];
	if (t.type === "income" && t.allocations.length > 0) {
		return t.allocations.map((a) => ({ key: a.walletId, amount: a.amount }));
	}
	return [{ key: t.walletId ?? NONE, amount: t.amount }];
}

type Described = Omit<Row, "amount" | "share" | "previous" | "change">;

function describe(key: string, lens: Lens, byId: Map<string, Category>, wallets: Wallet[]): Described {
	const walletRows = lens.dimension === "wallet" && !lens.drill;
	if (walletRows) {
		const wallet = wallets.find((w) => w.id === key);
		if (wallet) {
			return {
				key,
				name: wallet.name,
				context: null,
				kind: "wallet",
				color: wallet.color,
				icon: wallet.icon,
				drill: { kind: "wallet", id: key },
			};
		}
		return {
			key,
			name: key === UNALLOCATED_ID ? UNALLOCATED_NAME : key === NONE ? "Hamyonsiz" : "Noma'lum hamyon",
			context: null,
			kind: "wallet",
			color: null,
			icon: null,
			drill: key === NONE ? null : { kind: "wallet", id: key },
		};
	}

	const [categoryId, subId] = key.split(":");
	const category = byId.get(categoryId);
	if (!category) {
		return {
			key,
			name: "Kategoriyasiz",
			context: null,
			kind: "category",
			color: null,
			icon: null,
			drill: null,
		};
	}
	if (subId === undefined) {
		return {
			key,
			name: category.name,
			context: null,
			kind: "category",
			color: category.color,
			icon: category.icon,
			// Only a plain category opens up, and only into subcategories it has.
			drill:
				lens.dimension === "category" && !lens.drill && category.subcategories.length > 0
					? { kind: "category", id: category.id }
					: null,
		};
	}
	const sub = category.subcategories.find((s) => s.id === subId);
	const inside = lens.drill?.kind === "category";
	return {
		key,
		name: sub?.name ?? (inside ? "Subkategoriyasiz" : category.name),
		context: inside ? null : sub ? category.name : "subkategoriyasiz",
		kind: "category",
		color: sub?.color ?? category.color,
		icon: category.icon,
		drill: null,
	};
}

/** The name a drilled-into row goes by in the breadcrumb. */
export function drillName(drill: Drill, categories: Category[], wallets: Wallet[]): string {
	if (drill.kind === "category") {
		return categories.find((c) => c.id === drill.id)?.name ?? "Kategoriyasiz";
	}
	if (drill.id === UNALLOCATED_ID) return UNALLOCATED_NAME;
	return wallets.find((w) => w.id === drill.id)?.name ?? "Noma'lum hamyon";
}

/**
 * One side of the ledger (income or expense) broken down by the lens over a
 * period, with each row set against the comparison, and split into the
 * chart's columns. The chart draws at most `maxSeries` lines; past that the
 * smallest rows fold into one "Boshqa", while the ranked rows stay whole.
 */
export function composition({
	transactions,
	lens,
	categories,
	wallets,
	window,
	comparison,
	columns,
	maxSeries,
}: {
	/** One side only, scoped to one unit and filtered for debts. */
	transactions: Transaction[];
	lens: Lens;
	categories: Category[];
	wallets: Wallet[];
	window: Window;
	comparison: Comparison | null;
	columns: Column[];
	maxSeries: number;
}): Composition {
	const byId = new Map(categories.map((c) => [c.id, c]));
	const amounts = new Map<string, number>();
	const soFar = new Map<string, number>();
	const before = new Map<string, number>();
	const perColumn = columns.map(() => new Map<string, number>());
	const add = (map: Map<string, number>, key: string, amount: number) =>
		map.set(key, (map.get(key) ?? 0) + amount);

	for (const t of transactions) {
		const current = inWindow(t.date, window);
		const compared = comparison !== null && inWindow(t.date, comparison.current);
		const previous = comparison !== null && inWindow(t.date, comparison.previous);
		if (!current && !previous) continue;
		const column = current ? columnOf(columns, t.date) : -1;
		for (const part of partsOf(t, lens, byId)) {
			if (current) add(amounts, part.key, part.amount);
			if (compared) add(soFar, part.key, part.amount);
			if (previous) add(before, part.key, part.amount);
			if (column >= 0) add(perColumn[column], part.key, part.amount);
		}
	}

	const total = [...amounts.values()].reduce((acc, n) => acc + n, 0);
	const rows: Row[] = [...amounts.entries()]
		.map(([key, amount]) => {
			const previous = comparison ? (before.get(key) ?? 0) : null;
			return {
				...describe(key, lens, byId, wallets),
				amount,
				share: total > 0 ? amount / total : 0,
				previous,
				change: previous === null ? null : change(soFar.get(key) ?? 0, previous),
			};
		})
		.sort((a, b) => b.amount - a.amount);

	const folds = rows.length > maxSeries;
	const tracked = folds ? rows.slice(0, maxSeries - 1) : rows;
	const trackedKeys = new Set(tracked.map((r) => r.key));
	const series: Series[] = tracked.map((r) => ({ key: r.key, name: r.name, color: r.color }));
	if (folds) series.push({ key: OTHER_KEY, name: "Boshqa", color: null });

	return {
		rows,
		total,
		change: comparison
			? change(
					[...soFar.values()].reduce((acc, n) => acc + n, 0),
					[...before.values()].reduce((acc, n) => acc + n, 0),
				)
			: null,
		series,
		columns: perColumn.map((map) => {
			const values: Record<string, number> = {};
			for (const [key, amount] of map) {
				const target = trackedKeys.has(key) ? key : OTHER_KEY;
				values[target] = (values[target] ?? 0) + amount;
			}
			return values;
		}),
	};
}

/** Which series a row is drawn as on the chart — itself, or the folded rest. */
export function seriesOf(rowKey: string, series: Series[]): string {
	return series.some((s) => s.key === rowKey) ? rowKey : OTHER_KEY;
}

/* Insights ----------------------------------------------------------------- */

export type Insight =
	| { kind: "rise" | "fall"; row: Row }
	| { kind: "peak"; column: Column; amount: number; lead: string | null }
	| { kind: "average"; per: "day" | "month"; amount: number };

/** A row smaller than this share of the period before isn't worth a headline:
 *  going from almost nothing to a little more is a big percentage of nothing. */
const NOTABLE_SHARE = 0.05;

/**
 * What stands out in a breakdown: the row that grew the most and the one that
 * shrank the most against the period before, the heaviest column, and — when
 * there's nothing to compare with — what a typical day or month came to.
 */
export function insights({
	data,
	columns,
	span,
	window,
	ledger,
	comparison,
	today = todayISO(),
}: {
	data: Composition;
	columns: Column[];
	span: Span;
	window: Window;
	ledger: Window;
	comparison: Comparison | null;
	today?: string;
}): Insight[] {
	const found: Insight[] = [];
	if (data.total <= 0) return found;

	const previousTotal = data.rows.reduce((acc, r) => acc + (r.previous ?? 0), 0);
	const comparable = data.rows.filter(
		(r) => r.change !== null && (r.previous ?? 0) >= previousTotal * NOTABLE_SHARE,
	);
	const rise = comparable.reduce<Row | null>(
		(best, r) => ((r.change ?? 0) > 0 && (!best || (r.change ?? 0) > (best.change ?? 0)) ? r : best),
		null,
	);
	const fall = comparable.reduce<Row | null>(
		(best, r) => ((r.change ?? 0) < 0 && (!best || (r.change ?? 0) < (best.change ?? 0)) ? r : best),
		null,
	);
	if (rise) found.push({ kind: "rise", row: rise });
	if (fall) found.push({ kind: "fall", row: fall });

	if (columns.length > 1) {
		const totals = data.columns.map((values) => Object.values(values).reduce((a, n) => a + n, 0));
		const peak = totals.indexOf(Math.max(...totals));
		if (totals[peak] > 0) {
			const lead = data.series
				.filter((s) => s.key !== OTHER_KEY)
				.reduce<{ name: string; amount: number } | null>((best, s) => {
					const amount = data.columns[peak][s.key] ?? 0;
					return amount > 0 && (!best || amount > best.amount) ? { name: s.name, amount } : best;
				}, null);
			found.push({ kind: "peak", column: columns[peak], amount: totals[peak], lead: lead?.name ?? null });
		}
	}

	// Averaged over the part of the period that has passed and the ledger
	// reaches — a year the app was first opened in April has nine months.
	if (!comparison) {
		const from = window.from > ledger.from ? window.from : ledger.from;
		const to = window.to < today ? window.to : today;
		if (span === "month") {
			const days = to >= from ? daysBetween(from, to) : 0;
			if (days > 0) found.push({ kind: "average", per: "day", amount: data.total / days });
		} else {
			const months = to >= from ? monthsFrom(monthKeyOf(from), monthKeyOf(to)).length : 0;
			if (months > 0) found.push({ kind: "average", per: "month", amount: data.total / months });
		}
	}
	return found;
}

/* Axis --------------------------------------------------------------------- */

/** A round number at or just above `value`, for the top of a chart's axis —
 *  so its gridlines land on figures a person would say out loud. */
export function niceCeil(value: number): number {
	if (value <= 0) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(value));
	for (const step of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
		if (step * magnitude >= value) return step * magnitude;
	}
	return 10 * magnitude;
}
