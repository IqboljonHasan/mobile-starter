import { type ReactNode, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import PieChart from "@/components/PieChart";
import StackedBarChart from "@/components/StackedBarChart";
import StatRow from "@/components/StatRow";
import { Card, PillTabs } from "@/components/ui";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { lastMonthKeys, lastYearKeys, monthKeyOf, monthName, yearKeyOf } from "@/lib/date";
import { inMonth, inYear, ofType, sum } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import {
	breakdown,
	type BreakdownLevel,
	type ChartKind,
	foldSlices,
	OTHER_KEY,
	sliceColor,
	type StackedPeriod,
	type StatSlice,
	stackedTrend,
	TREND_MONTHS,
	TREND_YEARS,
} from "@/lib/stats";
import type { Category, IconName, Transaction, TxType } from "@/lib/types";

export type Span = "month" | "year";

/** Rows the ranked list shows before it asks to be expanded. */
const COLLAPSED_ROWS = 10;
/** Slices a donut can tell apart before the tail folds into "Boshqa". */
const PIE_ROWS = 6;
/** Rows a stacked trend tracks on their own; the rest stack as "Boshqa". */
const TREND_ROWS = 5;

const CHART_KINDS: { kind: ChartKind; icon: IconName; label: string }[] = [
	{ kind: "trend", icon: "trending-up-outline", label: "Tendensiya" },
	{ kind: "bar", icon: "bar-chart-outline", label: "Ustunli diagramma" },
	{ kind: "pie", icon: "pie-chart-outline", label: "Doiraviy diagramma" },
];

/**
 * The Stats screen's breakdown: income or expense and category or
 * subcategory picked in one row above the card, the chart picked in its
 * header, and the rows drawn three ways. The period is
 * picked by the screen; the side starts fresh on every visit, while the chart
 * and grouping are remembered across restarts:
 *
 * - **Pie**: a donut of the period's biggest rows, with the list under it.
 * - **Bar**: every row ranked by length, which reads amounts more precisely
 *   than angle. Tapping a row opens its own trend right under it.
 * - **Trend**: the period's top rows stacked over the trailing months (or
 *   years) ending at the picked period, to see which line of spending is
 *   growing. Tapping a legend item isolates that row.
 *
 * `transactions` arrives already scoped to one unit and filtered for debts.
 */
export default function BreakdownStats({
	transactions,
	categories,
	unit,
	hideIncome,
	span,
	month,
	year,
}: {
	transactions: Transaction[];
	categories: Category[];
	unit: string;
	hideIncome: boolean;
	span: Span;
	month: string;
	year: string;
}) {
	const { tf } = useFont();
	const { isDark, tc } = useTheme();
	const {
		statsChart: kind,
		setStatsChart,
		statsLevel: level,
		setStatsLevel,
	} = usePreferences();

	const [type, setType] = useState<TxType>("expense");
	const [selected, setSelected] = useState<string | null>(null);
	const [focus, setFocus] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);

	const typed = useMemo(() => ofType(transactions, type), [transactions, type]);
	const inPeriod = useMemo(
		() => (span === "month" ? inMonth(typed, month) : inYear(typed, year)),
		[typed, span, month, year],
	);
	const rows = useMemo(
		() => breakdown(inPeriod, categories, level),
		[inPeriod, categories, level],
	);
	const total = useMemo(() => sum(inPeriod), [inPeriod]);

	// Ends at the picked period rather than today, so stepping back through
	// time keeps the chart about the period being looked at.
	const periodKeys = useMemo(
		() =>
			span === "month" ? lastMonthKeys(TREND_MONTHS, month) : lastYearKeys(TREND_YEARS, year),
		[span, month, year],
	);

	// The trend tracks the picked period's biggest rows. An empty period (the
	// month just started) would leave nothing to track, so it falls back to
	// the biggest rows across the whole plotted window.
	const trendRows = useMemo(() => {
		if (kind !== "trend") return [];
		if (rows.length > 0) return rows.slice(0, TREND_ROWS);
		const inWindow = new Set(periodKeys);
		const windowed = typed.filter((t) =>
			inWindow.has(span === "month" ? monthKeyOf(t.date) : yearKeyOf(t.date)),
		);
		return breakdown(windowed, categories, level).slice(0, TREND_ROWS);
	}, [kind, rows, typed, periodKeys, span, categories, level]);
	const trend = useMemo(
		() =>
			kind === "trend"
				? stackedTrend(
						typed,
						categories,
						level,
						span,
						periodKeys,
						trendRows.map((r) => r.key),
						true,
					)
				: [],
		[kind, typed, categories, level, span, periodKeys, trendRows],
	);
	const rowTrend = useMemo(
		() =>
			kind === "bar" && selected
				? stackedTrend(typed, categories, level, span, periodKeys, [selected], false)
				: [],
		[kind, selected, typed, categories, level, span, periodKeys],
	);

	const colorOf = (slice: StatSlice) => sliceColor(slice.key, slice.color, isDark, tc.mutedForeground);
	const iconOf = (slice: StatSlice): IconName =>
		slice.icon ?? (slice.key === OTHER_KEY ? "ellipsis-horizontal" : "pricetag-outline");
	const mask = type === "income" && hideIncome;

	const periodWord = span === "month" ? "oy" : "yil";
	const periodLabel = span === "month" ? monthName(month) : `${year}-yil`;
	const subtitle =
		kind === "trend"
			? `Oxirgi ${periodKeys.length} ${periodWord} · eng kattalari`
			: kind === "bar"
				? "Qatorni bosing — vaqt bo'yicha o'zgarishi"
				: undefined;

	const empty = (
		<Text className="text-muted-foreground text-center py-6" style={{ fontSize: tf.base }}>
			{span === "month" ? "Bu oyda yozuv yo'q." : "Bu yilda yozuv yo'q."}
		</Text>
	);

	const row = (
		slice: StatSlice,
		extra?: { active?: boolean; onPress?: () => void; bar?: boolean },
	) => (
		<StatRow
			name={slice.name}
			context={slice.context}
			icon={iconOf(slice)}
			color={colorOf(slice)}
			amount={slice.amount}
			share={slice.share}
			unit={unit}
			mask={mask}
			bar={extra?.bar}
			showPercent
			active={extra?.active}
			onPress={slice.key === OTHER_KEY ? undefined : extra?.onPress}
		/>
	);

	let body: ReactNode;
	if (kind === "trend") {
		const legend = [
			...trendRows,
			...(trend.some((p) => (p.segments.find((s) => s.key === OTHER_KEY)?.amount ?? 0) > 0)
				? [{ key: OTHER_KEY, name: "Boshqa", context: null, color: "blue", amount: 0, share: 0, count: 0 }]
				: []),
		];
		const colors = Object.fromEntries(legend.map((s) => [s.key, colorOf(s)]));
		const activeFocus = focus && legend.some((s) => s.key === focus) ? focus : null;
		const hasData = trend.some((p) => p.total > 0);

		body = hasData ? (
			<>
				<StackedBarChart periods={trend} colors={colors} focus={activeFocus} />
				<View className="flex-row flex-wrap gap-2 mt-3">
					{legend.map((slice) => {
						const active = slice.key === activeFocus;
						const dimmed = activeFocus !== null && !active;
						return (
							<Pressable
								key={slice.key}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								onPress={() => setFocus(active ? null : slice.key)}
								className={`flex-row items-center gap-1.5 px-2.5 py-1 rounded-full active:opacity-60 ${
									active ? "bg-primary-highlight" : "bg-muted"
								}`}
								style={{ opacity: dimmed ? 0.5 : 1 }}
							>
								<View
									style={{
										width: 8,
										height: 8,
										borderRadius: 4,
										backgroundColor: colors[slice.key],
									}}
								/>
								<Text
									className={active ? "text-primary font-semibold" : "text-foreground"}
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
								>
									{slice.name}
								</Text>
							</Pressable>
						);
					})}
				</View>
				<TrendSummary periods={trend} focus={activeFocus} span={span} unit={unit} mask={mask} />
			</>
		) : (
			<Text className="text-muted-foreground text-center py-6" style={{ fontSize: tf.base }}>
				{`Oxirgi ${periodKeys.length} ${periodWord}da yozuv yo'q.`}
			</Text>
		);
	} else if (rows.length === 0) {
		body = empty;
	} else if (kind === "pie") {
		const slices = foldSlices(rows, PIE_ROWS);
		body = (
			<>
				<PieChart slices={slices} unit={unit} hideTotal={mask} />
				<View className="gap-3 mt-5">
					{slices.map((slice) => (
						<View key={slice.key}>{row(slice, { bar: false })}</View>
					))}
				</View>
			</>
		);
	} else {
		const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
		body = (
			<View className="gap-5">
				{visible.map((slice) => {
					const open = slice.key === selected;
					return (
						<View key={slice.key}>
							{row(slice, {
								active: open,
								onPress: () => setSelected(open ? null : slice.key),
							})}
							{open && (
								<View className="mt-3 p-3 rounded-2xl bg-muted">
									<StackedBarChart
										periods={rowTrend}
										colors={{ [slice.key]: colorOf(slice) }}
										height={90}
									/>
									<TrendSummary
										periods={rowTrend}
										focus={null}
										span={span}
										unit={unit}
										mask={mask}
									/>
								</View>
							)}
						</View>
					);
				})}
				{rows.length > COLLAPSED_ROWS && (
					<Pressable
						accessibilityRole="button"
						onPress={() => setExpanded((prev) => !prev)}
						className="items-center py-1 active:opacity-60"
					>
						<Text className="font-semibold text-primary" style={{ fontSize: tf.sm }}>
							{expanded
								? "Kamroq ko'rsatish"
								: `Yana ${rows.length - COLLAPSED_ROWS} tasini ko'rsatish`}
						</Text>
					</Pressable>
				)}
			</View>
		);
	}

	return (
		<>
			{/* Side and grouping share a row: both decide which rows are listed. */}
			<View className="flex-row gap-3">
				<View className="flex-1">
					<PillTabs
						fill
						items={[
							{ key: "expense", label: "Chiqim" },
							{ key: "income", label: "Kirim" },
						]}
						value={type}
						onChange={(key) => {
							setType(key);
							setSelected(null);
							setFocus(null);
						}}
					/>
				</View>
				<PillTabs
					items={[
						{ key: "category", label: "Kategoriya" },
						{ key: "subcategory", label: "Sub" },
					]}
					value={level}
					onChange={(key) => {
						// Row keys differ between the two groupings, so an open row or
						// a focused legend item wouldn't survive the switch anyway.
						setStatsLevel(key as BreakdownLevel);
						setSelected(null);
						setFocus(null);
						setExpanded(false);
					}}
				/>
			</View>

			{/* Breakdown -------------------------------------------------------- */}
			<Card
				title={level === "category" ? "Kategoriyalar bo'yicha" : "Subkategoriyalar bo'yicha"}
				subtitle={subtitle}
				headerRight={
					<PillTabs
						items={CHART_KINDS.map((c) => ({
							key: c.kind,
							icon: c.icon,
							accessibilityLabel: c.label,
						}))}
						value={kind}
						onChange={setStatsChart}
					/>
				}
			>
				{kind !== "trend" && (
					<View className="mb-4">
						<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
							{`Jami ${type === "income" ? "kirim" : "chiqim"} · ${periodLabel}`}
						</Text>
						<AmountText amount={total} unit={unit} size={tf.xxl} mask={mask} />
					</View>
				)}
				{body}
			</Card>
		</>
	);
}

/** Total and per-period average over a trend's window — for one row when
 *  `focus` names it, otherwise for everything plotted. */
function TrendSummary({
	periods,
	focus,
	span,
	unit,
	mask,
}: {
	periods: StackedPeriod[];
	focus: string | null;
	span: Span;
	unit: string;
	mask: boolean;
}) {
	const { tf } = useFont();
	const total = periods.reduce(
		(acc, p) =>
			acc + (focus ? (p.segments.find((s) => s.key === focus)?.amount ?? 0) : p.total),
		0,
	);
	// Averaged over every plotted period, empty ones included — a line of
	// spending that skips months really does cost less per month.
	const average = periods.length > 0 ? total / periods.length : 0;
	const show = (amount: number) => (mask ? maskAmount(unit) : formatAmount(amount, unit));
	const across = `${periods.length} ${span === "month" ? "oyda" : "yilda"}`;

	return (
		<View className="flex-row mt-3">
			<View className="flex-1">
				<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
					{`Jami, ${across}`}
				</Text>
				<Text className="font-semibold text-foreground" style={{ fontSize: tf.sm }}>
					{show(total)}
				</Text>
			</View>
			<View className="flex-1 items-end">
				<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
					{span === "month" ? "O'rtacha oyiga" : "O'rtacha yiliga"}
				</Text>
				<Text className="font-semibold text-foreground" style={{ fontSize: tf.sm }}>
					{show(average)}
				</Text>
			</View>
		</View>
	);
}
