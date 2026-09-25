import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import MonthSwitcher from "@/components/MonthSwitcher";
import PieChart from "@/components/PieChart";
import StackedBarChart from "@/components/StackedBarChart";
import YearSwitcher from "@/components/YearSwitcher";
import { Card, SegmentedControl } from "@/components/ui";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	currentMonthKey,
	currentYearKey,
	lastMonthKeys,
	lastYearKeys,
	monthKeyOf,
	yearKeyOf,
} from "@/lib/date";
import { inMonth, inYear, ofType } from "@/lib/ledger";
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
import type { Category, Transaction, TxType } from "@/lib/types";

type Span = "month" | "year";

/** Rows the ranked list shows before it asks to be expanded. */
const COLLAPSED_ROWS = 10;
/** Slices a donut can tell apart before the tail folds into "Boshqa". */
const PIE_ROWS = 6;
/** Rows a stacked trend tracks on their own; the rest stack as "Boshqa". */
const TREND_ROWS = 5;

const CHART_KINDS: { kind: ChartKind; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
	{ kind: "trend", icon: "trending-up-outline", label: "Tendensiya" },
	{ kind: "bar", icon: "bar-chart-outline", label: "Ustunli diagramma" },
	{ kind: "pie", icon: "pie-chart-outline", label: "Doiraviy diagramma" },
];

/**
 * The Stats screen's breakdown: category or subcategory, by month or year,
 * drawn three ways. The grouping and the chart are remembered across restarts;
 * the period and type start fresh, since they're about what's being looked at
 * right now:
 *
 * - **Pie**: a donut of the period's biggest rows, with the list under it.
 * - **Bar**: every row ranked by length, which reads amounts more precisely
 *   than angle. Tapping a row opens its own trend right under it.
 * - **Trend**: the period's top rows stacked over the trailing months (or
 *   years) ending at the picked period, to see which line of spending is
 *   growing. Tapping a legend item isolates that row.
 *
 * `transactions` arrives already scoped to one unit and filtered for debts;
 * the grouping, period, type, and chart are chosen here.
 */
export default function BreakdownStats({
	transactions,
	categories,
	unit,
	hideIncome,
}: {
	transactions: Transaction[];
	categories: Category[];
	unit: string;
	hideIncome: boolean;
}) {
	const { tf } = useFont();
	const { isDark, tc } = useTheme();
	const {
		statsChart: kind,
		setStatsChart,
		statsLevel: level,
		setStatsLevel,
	} = usePreferences();

	const [span, setSpan] = useState<Span>("month");
	const [month, setMonth] = useState(currentMonthKey);
	const [year, setYear] = useState(currentYearKey);
	const [type, setType] = useState<TxType>("expense");
	const [selected, setSelected] = useState<string | null>(null);
	const [focus, setFocus] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);

	const typed = useMemo(() => ofType(transactions, type), [transactions, type]);
	const rows = useMemo(() => {
		const inPeriod = span === "month" ? inMonth(typed, month) : inYear(typed, year);
		return breakdown(inPeriod, categories, level);
	}, [typed, span, month, year, categories, level]);

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
	const mask = type === "income" && hideIncome;

	const header = (
		<View className="flex-row gap-1">
			{CHART_KINDS.map((item) => {
				const active = item.kind === kind;
				return (
					<Pressable
						key={item.kind}
						accessibilityRole="button"
						accessibilityLabel={item.label}
						accessibilityState={{ selected: active }}
						onPress={() => setStatsChart(item.kind)}
						hitSlop={4}
						className={`w-9 h-9 items-center justify-center rounded-full active:opacity-60 ${
							active ? "bg-primary-highlight" : "bg-muted"
						}`}
					>
						<Ionicons
							name={item.icon}
							size={18}
							color={active ? tc.primary : tc.mutedForeground}
						/>
					</Pressable>
				);
			})}
		</View>
	);

	const periodWord = span === "month" ? "oy" : "yil";
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
						<Row key={slice.key} slice={slice} color={colorOf(slice)} unit={unit} mask={mask} />
					))}
				</View>
			</>
		);
	} else {
		const visible = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
		body = (
			<View className="gap-3">
				{visible.map((slice) => {
					const color = colorOf(slice);
					const open = slice.key === selected;
					return (
						<View key={slice.key}>
							<Row
								slice={slice}
								color={color}
								unit={unit}
								mask={mask}
								bar
								active={open}
								onPress={() => setSelected(open ? null : slice.key)}
							/>
							{open && (
								<View className="mt-3 p-3 rounded-2xl bg-muted">
									<StackedBarChart
										periods={rowTrend}
										colors={{ [slice.key]: color }}
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
		<Card
			title={level === "category" ? "Kategoriyalar bo'yicha" : "Subkategoriyalar bo'yicha"}
			subtitle={subtitle}
			headerRight={header}
		>
			<SegmentedControl
				items={[
					{ key: "category", label: "Kategoriya" },
					{ key: "subcategory", label: "Subkategoriya" },
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
				className="bg-muted mb-2"
			/>
			<SegmentedControl
				items={[
					{ key: "month", label: "Oylik" },
					{ key: "year", label: "Yillik" },
				]}
				value={span}
				onChange={(key) => setSpan(key as Span)}
				className="bg-muted mb-3"
			/>
			{span === "month" ? (
				<MonthSwitcher value={month} onChange={setMonth} />
			) : (
				<YearSwitcher value={year} onChange={setYear} />
			)}
			<SegmentedControl
				items={[
					{ key: "expense", label: "Chiqim" },
					{ key: "income", label: "Kirim" },
				]}
				value={type}
				onChange={(key) => {
					setType(key as TxType);
					setSelected(null);
					setFocus(null);
				}}
				className="bg-muted mt-4 mb-4"
			/>
			{body}
		</Card>
	);
}

/**
 * One ranked row: the name (with its category or "subkategoriyasiz" under it
 * at the subcategory level), the amount, and — in the bar view — a bar of its
 * share. Every row is directly labelled, so color never carries identity alone.
 */
function Row({
	slice,
	color,
	unit,
	mask,
	bar = false,
	active = false,
	onPress,
}: {
	slice: StatSlice;
	color: string;
	unit: string;
	mask: boolean;
	bar?: boolean;
	active?: boolean;
	onPress?: () => void;
}) {
	const { tf } = useFont();
	const percent = slice.share < 0.01 ? "<1%" : `${Math.round(slice.share * 100)}%`;
	const amountText = mask ? maskAmount(unit) : formatAmount(slice.amount, unit);
	const interactive = !!onPress && slice.key !== OTHER_KEY;

	return (
		<Pressable
			accessibilityRole={interactive ? "button" : "text"}
			accessibilityState={interactive ? { expanded: active } : undefined}
			accessibilityLabel={`${slice.name}${slice.context ? `, ${slice.context}` : ""}, ${
				mask ? "yashirilgan" : formatAmount(slice.amount, unit)
			}, ${percent}`}
			disabled={!interactive}
			onPress={onPress}
			className={interactive ? "active:opacity-70" : undefined}
		>
			<View className="flex-row items-center gap-2">
				<View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
				<View className="flex-1">
					<Text
						className={`font-medium ${active ? "text-primary" : "text-foreground"}`}
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{slice.name}
					</Text>
					{slice.context !== null && (
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.xs }}
							numberOfLines={1}
						>
							{`${slice.context} · ${slice.count} ta`}
						</Text>
					)}
				</View>
				<Text
					className="font-semibold text-foreground"
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{amountText}
				</Text>
				{!bar && (
					<Text
						className="text-muted-foreground text-right"
						style={{ fontSize: tf.xs, width: 38 }}
					>
						{percent}
					</Text>
				)}
			</View>
			{bar && (
				<View className="flex-row items-center gap-2 mt-1.5">
					<View className="flex-1 rounded-full bg-muted overflow-hidden" style={{ height: 8 }}>
						<View
							style={{
								// A zero-width bar reads as a rendering bug; a hairline
								// reads as "almost nothing", which is the truth.
								width: `${Math.max(slice.share * 100, 1.5)}%`,
								height: 8,
								borderRadius: 4,
								backgroundColor: color,
							}}
						/>
					</View>
					<Text
						className="text-muted-foreground text-right"
						style={{ fontSize: tf.xs, width: 38 }}
					>
						{percent}
					</Text>
				</View>
			)}
		</Pressable>
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
