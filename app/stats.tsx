import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import AmountText from "@/components/AmountText";
import CategoryAvatar from "@/components/CategoryAvatar";
import ScrollShadow from "@/components/ScrollShadow";
import TransactionRow from "@/components/TransactionRow";
import TrendChart, { type ChartColumn, type ChartSeries } from "@/components/TrendChart";
import WalletIcon from "@/components/WalletIcon";
import { PillTabs } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, softTint } from "@/lib/categoryColors";
import {
	currentMonthKey,
	currentYearKey,
	formatDate,
	monthKeyOf,
	monthShortLabel,
	monthTitle,
	shiftMonth,
	yearKeyOf,
} from "@/lib/date";
import { countedForStats, inUnit, ofType, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import {
	change,
	type ChartKind,
	comparisonOf,
	composition,
	compositionColumns,
	type Dimension,
	type Drill,
	drillName,
	flowByColumn,
	flowColumns,
	flowIn,
	type Insight,
	insights,
	ledgerWindow,
	OTHER_KEY,
	periodWindow,
	type Row,
	type Span,
	seriesOf,
} from "@/lib/stats";
import type { IconName, TxType } from "@/lib/types";
import { walletShare } from "@/lib/wallets";
import "../global.css";

/** Lines the composition chart can tell apart; past that the rest fold. */
const MAX_SERIES = 6;
/** Lines drawn at first — the rest are a tap on the legend away. */
const DEFAULT_LINES = 3;
/** Rows the ranking shows before it asks to be expanded. */
const COLLAPSED_ROWS = 10;
const BIGGEST = 5;

const SPANS: { key: Span; label: string }[] = [
	{ key: "month", label: "Oy" },
	{ key: "year", label: "Yil" },
	{ key: "all", label: "Butun davr" },
];

const SIDES: { key: TxType; label: string }[] = [
	{ key: "expense", label: "Chiqim" },
	{ key: "income", label: "Kirim" },
];

const DIMENSIONS: { key: Dimension; label: string }[] = [
	{ key: "category", label: "Kategoriya" },
	{ key: "subcategory", label: "Sub" },
	{ key: "wallet", label: "Hamyon" },
];

const CHART_KINDS: { key: ChartKind; icon: IconName; accessibilityLabel: string }[] = [
	{ key: "line", icon: "trending-up-outline", accessibilityLabel: "Chiziqli grafik" },
	{ key: "bar", icon: "bar-chart-outline", accessibilityLabel: "Ustunli grafik" },
];

/** The month Home was showing when it opened this screen, if it's a real one. */
function initialMonth(param: string | undefined): string {
	const now = currentMonthKey();
	return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) && param <= now ? param : now;
}

function clamp(key: string, first: string, last: string): string {
	return key < first ? first : key > last ? last : key;
}

/** "12%" — or "999+%" once it stops meaning anything. */
function percent(fraction: number): string {
	const n = Math.round(Math.abs(fraction) * 100);
	return n > 999 ? "999+%" : `${n}%`;
}

/** "+12%", "−5%", "0%" — and a dash when there was nothing to compare with. */
function signedPercent(fraction: number | null): string {
	if (fraction === null) return "—";
	const text = percent(fraction);
	return text === "0%" ? text : `${fraction > 0 ? "+" : "−"}${text}`;
}

/**
 * Tahlil: the ledger over one month, one year, or all of it.
 *
 * The period and what came in, went out and was left over in it stay pinned
 * at the top. Under them, in the order the questions come:
 *
 * - **Dynamics** — income against expense column by column, around the
 *   period: for a month, every month the ledger has (a column picks another
 *   month); for a year, its months; for the whole ledger, its years. The
 *   picked column is spelled out under the chart, against the one before.
 * - **Composition** — where one side went, by category, subcategory or
 *   wallet, split across the period's weeks, months or quarters. A category
 *   opens into its subcategories and a wallet into the categories that went
 *   through it.
 * - The same rows **ranked**, each against the period before; what **stands
 *   out**; and the **biggest entries** behind it all.
 */
export default function StatsScreen() {
	const router = useRouter();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ month?: string }>();
	const { ready, transactions, categories, wallets, debts, defaultUnit } = useLedger();
	const {
		hideIncome,
		includeDebtsInStats,
		uncollectedLoansAsExpense,
		statsChart,
		setStatsChart,
		statsFlowChart,
		setStatsFlowChart,
		statsDimension,
		setStatsDimension,
	} = usePreferences();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [span, setSpan] = useState<Span>("month");
	const [month, setMonth] = useState(() => initialMonth(params.month));
	const [year, setYear] = useState(() => yearKeyOf(initialMonth(params.month)));
	// The dynamics' picked column, for a year or the whole ledger. A month
	// view's picked column is the month itself.
	const [flowPick, setFlowPick] = useState<number | null>(null);
	const [side, setSide] = useState<TxType>("expense");
	const [drill, setDrill] = useState<Drill | null>(null);
	// A row or a series picked out: the chart draws everything else faint.
	const [focus, setFocus] = useState<string | null>(null);
	const [column, setColumn] = useState<number | null>(null);
	// Which series each view draws as lines, once the user has changed it.
	const [shownLines, setShownLines] = useState<Record<string, string[]>>({});
	const [expanded, setExpanded] = useState(false);
	const { scrolled, scrollProps } = useScrolled();

	// Every unit ever used, not just this month's — the whole point of this
	// screen is the view a single month is too narrow for.
	const units = useMemo(() => {
		const used = unitsUsed(transactions);
		return used.length > 0 ? used : [defaultUnit];
	}, [transactions, defaultUnit]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: units[0];

	const relevant = useMemo(() => {
		const scoped = inUnit(transactions, unit);
		return countedForStats(scoped, debts, {
			includeDebts: includeDebtsInStats,
			uncollectedLoans: uncollectedLoansAsExpense,
		});
	}, [transactions, debts, unit, includeDebtsInStats, uncollectedLoansAsExpense]);

	// The period stays inside what the ledger reaches, however the unit or the
	// debts switch has moved its ends since it was picked.
	const ledger = useMemo(() => ledgerWindow(relevant), [relevant]);
	const monthKey = clamp(month, monthKeyOf(ledger.from), monthKeyOf(ledger.to));
	const yearKey = clamp(year, yearKeyOf(ledger.from), yearKeyOf(ledger.to));
	const key = span === "month" ? monthKey : span === "year" ? yearKey : "";

	const period = useMemo(() => periodWindow(span, key, ledger), [span, key, ledger]);
	const comparison = useMemo(() => comparisonOf(span, key, ledger), [span, key, ledger]);
	const totals = useMemo(() => flowIn(relevant, period), [relevant, period]);

	/* Dynamics ------------------------------------------------------------ */

	const flowCols = useMemo(() => flowColumns(span, key, ledger), [span, key, ledger]);
	const flows = useMemo(() => flowByColumn(relevant, flowCols), [relevant, flowCols]);
	const flowIndex =
		span === "month"
			? flowCols.findIndex((c) => c.key === monthKey)
			: flowPick !== null && flowPick < flowCols.length
				? flowPick
				: -1;
	const flowSelected = flowIndex >= 0 ? flowIndex : null;

	const flowDetail = useMemo(() => {
		if (flowSelected === null) return null;
		const col = flowCols[flowSelected];
		const cmp = col.period ? comparisonOf(col.period.span, col.period.key, ledger) : null;
		if (!cmp) return { column: col, flow: flows[flowSelected], deltas: null };
		const now = flowIn(relevant, cmp.current);
		const before = flowIn(relevant, cmp.previous);
		return {
			column: col,
			flow: flows[flowSelected],
			deltas: {
				income: change(now.income, before.income),
				expense: change(now.expense, before.expense),
				net: change(now.income - now.expense, before.income - before.expense),
				label: cmp.label,
			},
		};
	}, [flowSelected, flowCols, flows, ledger, relevant]);

	/* Composition --------------------------------------------------------- */

	const typed = useMemo(() => ofType(relevant, side), [relevant, side]);
	const compCols = useMemo(() => compositionColumns(span, key, ledger), [span, key, ledger]);
	const data = useMemo(
		() =>
			composition({
				transactions: typed,
				lens: { dimension: statsDimension, drill },
				categories,
				wallets,
				window: period,
				comparison,
				columns: compCols,
				maxSeries: MAX_SERIES,
			}),
		[typed, statsDimension, drill, categories, wallets, period, comparison, compCols],
	);
	const found = useMemo(
		() => insights({ data, columns: compCols, span, window: period, ledger, comparison }),
		[data, compCols, span, period, ledger, comparison],
	);
	const biggest = useMemo(() => {
		const amountOf = (t: (typeof typed)[number]) =>
			drill?.kind === "wallet"
				? walletShare(t, drill.id)
				: drill?.kind === "category" && t.categoryId !== drill.id
					? 0
					: t.amount;
		return typed
			.filter((t) => t.date >= period.from && t.date <= period.to)
			.map((t) => ({ transaction: t, amount: amountOf(t) }))
			.filter((x) => x.amount > 0)
			.sort((a, b) => b.amount - a.amount)
			.slice(0, BIGGEST);
	}, [typed, drill, period]);

	const linesKey = `${side}|${drill ? `${drill.kind}:${drill.id}` : statsDimension}`;
	const named = data.series.filter((s) => s.key !== OTHER_KEY).map((s) => s.key);
	const stored = (shownLines[linesKey] ?? []).filter((k) => data.series.some((s) => s.key === k));
	const lines =
		stored.length > 0
			? stored
			: (named.length > 0 ? named : data.series.map((s) => s.key)).slice(0, DEFAULT_LINES);
	const focusSeries = focus ? seriesOf(focus, data.series) : null;
	const pickedColumn = column !== null && column < compCols.length ? column : null;

	/* Formatting ---------------------------------------------------------- */

	const mask = side === "income" && hideIncome;
	const colorOf = (color: string | null) =>
		color ? categoryColorValue(color, isDark) : tc.mutedForeground;
	// The main currency goes bare, as in the ledger; any other keeps its symbol.
	const showUnit = unit !== defaultUnit;
	const money = (amount: number, options: { signed?: boolean; masked?: boolean } = {}) =>
		options.masked
			? showUnit
				? maskAmount(unit)
				: "••••"
			: formatAmount(amount, unit, { showUnit, signed: options.signed });
	const goodColor = (fraction: number, goodWhenUp: boolean) =>
		fraction === 0 ? tc.mutedForeground : fraction > 0 === goodWhenUp ? tc.success : tc.danger;

	const periodLabel =
		span === "month" ? monthTitle(monthKey) : span === "year" ? `${yearKey} yil` : "Butun davr";
	const sideWord = side === "expense" ? "chiqim" : "kirim";
	const drilledName = drill ? drillName(drill, categories, wallets) : "";

	/* Actions ------------------------------------------------------------- */

	const resetPicks = () => {
		setColumn(null);
		setFlowPick(null);
	};

	// Switching between a month and a year keeps the user's place: a month
	// opens onto its own year, and a year onto its latest month that has begun.
	const changeSpan = (next: Span) => {
		if (next === "year") setYear(yearKeyOf(monthKey));
		else if (next === "month" && span === "year" && yearKeyOf(monthKey) !== yearKey) {
			setMonth(yearKey === currentYearKey() ? currentMonthKey() : `${yearKey}-12`);
		}
		setSpan(next);
		resetPicks();
	};

	const changeSide = (next: TxType) => {
		setSide(next);
		setDrill(null);
		setFocus(null);
		setColumn(null);
		setExpanded(false);
	};

	const changeDimension = (next: Dimension) => {
		setStatsDimension(next);
		setDrill(null);
		setFocus(null);
		setExpanded(false);
	};

	const openRow = (row: Row) => {
		if (row.drill) {
			setDrill(row.drill);
			setFocus(null);
			setColumn(null);
			setExpanded(false);
			return;
		}
		const next = focus === row.key ? null : row.key;
		setFocus(next);
		// A row picked out on the line chart is drawn, even if its line was off.
		const target = next ? seriesOf(next, data.series) : null;
		if (statsChart === "line" && target && !lines.includes(target)) {
			setShownLines((prev) => ({ ...prev, [linesKey]: [...lines, target] }));
		}
	};

	const toggleLegend = (seriesKey: string) => {
		if (statsChart === "bar") {
			setFocus(focusSeries === seriesKey ? null : seriesKey);
			return;
		}
		const next = lines.includes(seriesKey)
			? lines.length > 1
				? lines.filter((k) => k !== seriesKey)
				: lines
			: [...lines, seriesKey];
		setShownLines((prev) => ({ ...prev, [linesKey]: next }));
	};

	if (!ready) {
		return (
			<>
				<Stack.Screen options={{ title: "Tahlil" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.foreground} />
				</View>
			</>
		);
	}

	/* Pieces -------------------------------------------------------------- */

	const flowSeries: ChartSeries[] = [
		{ key: "income", color: tc.success },
		{ key: "expense", color: tc.danger },
	];
	const flowChartColumns: ChartColumn[] = flowCols.map((c, i) => ({
		key: c.key,
		label: c.label,
		sublabel: c.sublabel,
		accessibilityLabel: `${c.title}: kirim ${money(flows[i].income, { masked: hideIncome })}, chiqim ${money(flows[i].expense)}`,
		values: { income: flows[i].income, expense: flows[i].expense },
	}));

	const compSeries: ChartSeries[] = data.series.map((s) => ({ key: s.key, color: colorOf(s.color) }));
	const columnTotal = (i: number) => Object.values(data.columns[i]).reduce((acc, n) => acc + n, 0);
	const compChartColumns: ChartColumn[] = compCols.map((c, i) => ({
		key: c.key,
		label: c.label,
		sublabel: c.sublabel,
		accessibilityLabel: `${c.title}: jami ${money(columnTotal(i), { masked: mask })}`,
		values: data.columns[i],
	}));

	const net = totals.income - totals.expense;
	const empty = data.total <= 0;
	const visibleRows = expanded ? data.rows : data.rows.slice(0, COLLAPSED_ROWS);
	const maxRow = data.rows[0]?.amount ?? 0;
	const drillable = data.rows.some((r) => r.drill);

	return (
		<>
			<Stack.Screen options={{ title: "Tahlil" }} />
			<View className="flex-1 bg-background">
				{/* Period, and what it came to: pinned above everything it scopes */}
				<View className="bg-background" style={{ paddingHorizontal: 18, paddingBottom: 12, gap: 12 }}>
					<View className="flex-row items-center" style={{ gap: 6 }}>
						<PillTabs
							compact
							variant="inverse"
							items={SPANS}
							value={span}
							onChange={changeSpan}
						/>
						<View className="flex-1">
							{span === "month" ? (
								<PeriodNav
									label={`${capitalize(monthShortLabel(monthKey))} ${yearKeyOf(monthKey)}`}
									accessibilityLabel={monthTitle(monthKey)}
									unitWord="oy"
									canPrev={monthKey > monthKeyOf(ledger.from)}
									canNext={monthKey < monthKeyOf(ledger.to)}
									onStep={(delta) => {
										setMonth(shiftMonth(monthKey, delta));
										resetPicks();
									}}
									onReset={() => {
										setMonth(currentMonthKey());
										resetPicks();
									}}
								/>
							) : span === "year" ? (
								<PeriodNav
									label={yearKey}
									accessibilityLabel={`${yearKey} yil`}
									unitWord="yil"
									canPrev={yearKey > yearKeyOf(ledger.from)}
									canNext={yearKey < yearKeyOf(ledger.to)}
									onStep={(delta) => {
										setYear(String(Number(yearKey) + delta));
										resetPicks();
									}}
									onReset={() => {
										setYear(currentYearKey());
										resetPicks();
									}}
								/>
							) : (
								<Text
									className="font-extrabold text-foreground text-center"
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
									adjustsFontSizeToFit
								>
									{`${formatDate(ledger.from)} – bugun`}
								</Text>
							)}
						</View>
					</View>
					{units.length > 1 && (
						<PillTabs
							compact
							fill
							items={units.map((code) => ({ key: code, label: code }))}
							value={unit}
							onChange={setPickedUnit}
						/>
					)}
					<View
						accessible
						accessibilityLabel={`${periodLabel}: kirim ${money(totals.income, { masked: hideIncome })}, chiqim ${money(totals.expense)}, foyda ${money(net, { signed: true, masked: hideIncome })}`}
						className="flex-row rounded-[18px] bg-card"
						style={{ paddingVertical: 10 }}
					>
						<SummaryCell label="Kirim" dot={tc.success} value={money(totals.income, { masked: hideIncome })} />
						<SummaryCell
							label="Chiqim"
							dot={tc.danger}
							value={money(totals.expense)}
							divider
						/>
						<SummaryCell
							label="Foyda"
							value={money(net, { signed: true, masked: hideIncome })}
							color={hideIncome || net === 0 ? undefined : net > 0 ? tc.success : tc.danger}
							divider
						/>
					</View>
				</View>

				{/* The shade under the pinned block is drawn inside the scroll area,
				    so it falls only below it, over the content passing under. */}
				<View className="flex-1">
					<ScrollView
						className="flex-1"
						contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, gap: 12, paddingBottom: 40 }}
						showsVerticalScrollIndicator={false}
						{...scrollProps}
					>
						{/* Dynamics -------------------------------------------------- */}
						<Panel>
							<View className="flex-row items-start justify-between" style={{ gap: 8 }}>
								<PanelTitle
									title="Kirim va chiqim dinamikasi"
									subtitle={
										span === "month"
											? "Oylar bo'yicha · oyni bosib tanlang"
											: span === "year"
												? `${yearKey} yil · oylar bo'yicha`
												: "Yillar bo'yicha"
									}
								/>
								<PillTabs
									compact
									variant="inverse"
									items={CHART_KINDS}
									value={statsFlowChart}
									onChange={setStatsFlowChart}
								/>
							</View>
							<View style={{ marginTop: 14 }}>
								<TrendChart
									columns={flowChartColumns}
									series={flowSeries}
									kind={statsFlowChart}
									selected={flowSelected}
									onSelect={(i) => {
										if (span === "month") {
											setMonth(flowCols[i].key);
											setColumn(null);
										} else {
											setFlowPick(flowSelected === i ? null : i);
										}
									}}
									minColumnWidth={span === "month" ? 38 : span === "year" ? 28 : 64}
									maskAxis={hideIncome}
									unit={unit}
								/>
							</View>
							<View className="flex-row" style={{ gap: 14, marginTop: 8 }}>
								<LegendKey color={tc.success} label="Kirim" />
								<LegendKey color={tc.danger} label="Chiqim" />
							</View>
							<DetailBox>
								{flowDetail ? (
									<>
										<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm }}>
											{flowDetail.column.title}
										</Text>
										<View className="flex-row" style={{ gap: 4, marginTop: 6 }}>
											<DetailFigure
												label="Kirim"
												value={money(flowDetail.flow.income, { masked: hideIncome })}
												delta={hideIncome ? null : flowDetail.deltas?.income}
												deltaColor={(d) => goodColor(d, true)}
											/>
											<DetailFigure
												label="Chiqim"
												value={money(flowDetail.flow.expense)}
												delta={flowDetail.deltas?.expense}
												deltaColor={(d) => goodColor(d, false)}
											/>
											<DetailFigure
												label="Foyda"
												value={money(flowDetail.flow.income - flowDetail.flow.expense, {
													signed: true,
													masked: hideIncome,
												})}
												color={
													hideIncome
														? undefined
														: flowDetail.flow.income >= flowDetail.flow.expense
															? tc.success
															: tc.danger
												}
												delta={hideIncome ? null : flowDetail.deltas?.net}
												deltaColor={(d) => goodColor(d, true)}
											/>
										</View>
										{!!flowDetail.deltas && (
											<Text className="font-semibold" style={{ fontSize: tf.xs, color: tc.placeholder, marginTop: 4 }}>
												{flowDetail.deltas.label}
											</Text>
										)}
									</>
								) : (
									<Hint
										text={
											span === "year"
												? "Oyni bosing — kirim, chiqim va foyda chiqadi"
												: "Yilni bosing — kirim, chiqim va foyda chiqadi"
										}
									/>
								)}
							</DetailBox>
						</Panel>

						{/* Composition ----------------------------------------------- */}
						<Panel>
							<PanelTitle title="Tarkib bo'yicha" />
							<View className="flex-row items-center" style={{ gap: 8, marginTop: 10 }}>
								<View className="flex-1">
									<PillTabs compact fill variant="inverse" items={SIDES} value={side} onChange={changeSide} />
								</View>
								<PillTabs
									compact
									variant="inverse"
									items={CHART_KINDS}
									value={statsChart}
									onChange={setStatsChart}
								/>
							</View>
							<View className="justify-center" style={{ minHeight: 44, marginTop: 8 }}>
								{drill ? (
									<View accessibilityRole="header" className="flex-row items-center" style={{ gap: 6 }}>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`Orqaga: ${side === "expense" ? "Chiqim" : "Kirim"}`}
											onPress={() => {
												setDrill(null);
												setFocus(null);
												setColumn(null);
											}}
											className="flex-row items-center bg-muted rounded-full active:opacity-70"
											style={{ height: 34, paddingLeft: 8, paddingRight: 12, gap: 4 }}
										>
											<Ionicons name="chevron-back" size={16} color={tc.foreground} />
											<Text className="font-bold text-foreground" style={{ fontSize: tf.sm }}>
												{side === "expense" ? "Chiqim" : "Kirim"}
											</Text>
										</Pressable>
										<Text style={{ color: tc.placeholder }}>/</Text>
										<Text
											className="flex-1 font-extrabold text-foreground"
											style={{ fontSize: tf.base }}
											numberOfLines={1}
										>
											{drilledName}
										</Text>
									</View>
								) : (
									<PillTabs
										compact
										fill
										variant="inverse"
										items={DIMENSIONS}
										value={statsDimension}
										onChange={changeDimension}
									/>
								)}
							</View>

							<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.sm - 0.5, marginTop: 14 }}>
								{`Jami ${sideWord}${drill ? ` · ${drilledName}` : ""} · ${periodLabel}`}
							</Text>
							<View className="flex-row flex-wrap items-center" style={{ columnGap: 10, rowGap: 4, marginTop: 2 }}>
								<AmountText amount={data.total} unit={unit} size={tf.xxxl} mask={mask} />
								{data.change !== null && comparison && !mask && (
									<ChangeBadge
										change={data.change}
										label={comparison.label}
										color={goodColor(data.change, side === "income")}
									/>
								)}
							</View>

							{empty ? (
								<Text className="text-muted-foreground text-center" style={{ fontSize: tf.base, paddingVertical: 28 }}>
									{`${span === "month" ? "Bu oyda" : span === "year" ? "Bu yilda" : "Hali"} ${sideWord} yo'q.`}
								</Text>
							) : (
								<>
									<View style={{ marginTop: 14 }}>
										<TrendChart
											columns={compChartColumns}
											series={compSeries}
											kind={statsChart}
											stacked
											lines={lines}
											focus={focusSeries}
											selected={pickedColumn}
											onSelect={(i) => setColumn(pickedColumn === i ? null : i)}
											maskAxis={mask}
											unit={unit}
										/>
									</View>
									<View className="flex-row flex-wrap" style={{ gap: 6, marginTop: 10 }}>
										{data.series.map((s) => {
											const shown =
												statsChart === "line" ? lines.includes(s.key) : !focusSeries || focusSeries === s.key;
											return (
												<Pressable
													key={s.key}
													accessibilityRole="button"
													accessibilityState={{ selected: shown }}
													onPress={() => toggleLegend(s.key)}
													className="flex-row items-center border border-border rounded-full active:opacity-70"
													style={{
														height: 30,
														paddingHorizontal: 10,
														gap: 6,
														backgroundColor: shown ? tc.muted : "transparent",
													}}
												>
													<View
														style={[
															statsChart === "line"
																? { width: 12, height: 3, borderRadius: 2 }
																: { width: 9, height: 9, borderRadius: 3 },
															{ backgroundColor: shown ? colorOf(s.color) : tc.disabled },
														]}
													/>
													<Text
														className="font-bold"
														style={{ fontSize: tf.sm - 0.5, color: shown ? tc.foreground : tc.placeholder }}
														numberOfLines={1}
													>
														{s.name}
													</Text>
												</Pressable>
											);
										})}
									</View>
									{pickedColumn !== null && (
										<DetailBox>
											<View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
												<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm }}>
													{compCols[pickedColumn].title}
												</Text>
												<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm }}>
													{money(columnTotal(pickedColumn), { masked: mask })}
												</Text>
											</View>
											{data.series
												.map((s) => ({ ...s, amount: data.columns[pickedColumn][s.key] ?? 0 }))
												.filter((s) => s.amount > 0)
												.sort((a, b) => b.amount - a.amount)
												.map((s) => (
													<View key={s.key} className="flex-row items-center" style={{ height: 26, gap: 8 }}>
														<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colorOf(s.color) }} />
														<Text
															className="flex-1 font-semibold text-secondary-foreground"
															style={{ fontSize: tf.sm - 0.5 }}
															numberOfLines={1}
														>
															{s.name}
														</Text>
														<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm - 0.5 }}>
															{money(s.amount, { masked: mask })}
														</Text>
														<Text
															className="font-semibold text-muted-foreground text-right"
															style={{ fontSize: tf.sm - 0.5, width: 44 }}
														>
															{percent(s.amount / columnTotal(pickedColumn))}
														</Text>
													</View>
												))}
										</DetailBox>
									)}
								</>
							)}
						</Panel>

						{!empty && (
							<>
								{/* Ranking ------------------------------------------------- */}
								<View>
									<View className="flex-row items-baseline justify-between" style={{ height: 32, paddingHorizontal: 2 }}>
										<Text accessibilityRole="header" className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
											{drill
												? `${drilledName} tarkibi`
												: statsDimension === "wallet"
													? "Hamyonlar bo'yicha"
													: statsDimension === "subcategory"
														? "Subkategoriyalar"
														: "Kategoriyalar"}
										</Text>
										{drillable && (
											<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.xs }}>
												bosib ichiga kiring
											</Text>
										)}
									</View>
									<View style={{ marginHorizontal: -8, marginTop: 4 }}>
										{visibleRows.map((row) => (
											<RankRow
												key={row.key}
												row={row}
												max={maxRow}
												color={colorOf(row.color)}
												amount={money(row.amount, { masked: mask })}
												changeColor={row.change === null ? tc.placeholder : goodColor(row.change, side === "income")}
												active={focus === row.key}
												onPress={() => openRow(row)}
											/>
										))}
									</View>
									{data.rows.length > COLLAPSED_ROWS && (
										<Pressable
											accessibilityRole="button"
											onPress={() => setExpanded((prev) => !prev)}
											className="items-center py-2 active:opacity-60"
										>
											<Text className="font-bold text-primary" style={{ fontSize: tf.sm }}>
												{expanded
													? "Kamroq ko'rsatish"
													: `Yana ${data.rows.length - COLLAPSED_ROWS} tasini ko'rsatish`}
											</Text>
										</Pressable>
									)}
								</View>

								{/* What stands out ----------------------------------------- */}
								{found.length > 0 && (
									<View className="rounded-3xl bg-card" style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
										{found.map((insight, i) => (
											<InsightRow
												key={insight.kind}
												insight={insight}
												first={i === 0}
												side={side}
												money={(amount) => money(amount, { masked: mask })}
												comparedTo={comparison?.label ?? ""}
											/>
										))}
									</View>
								)}

								{/* The entries behind it ----------------------------------- */}
								<View>
									<Text
										accessibilityRole="header"
										className="font-extrabold text-foreground"
										style={{ fontSize: tf.base, lineHeight: 32, paddingHorizontal: 2 }}
									>
										{`${side === "expense" ? "Eng katta xarajatlar" : "Eng katta tushumlar"}${drill ? ` · ${drilledName}` : ""}`}
									</Text>
									{biggest.map(({ transaction, amount }, i) => (
										<TransactionRow
											key={transaction.id}
											transaction={transaction}
											categories={categories}
											divider={i > 0}
											showDate
											amountOverride={amount !== transaction.amount ? amount : undefined}
											onPress={() => router.push(`/transaction?id=${transaction.id}`)}
										/>
									))}
								</View>
							</>
						)}
					</ScrollView>
					<ScrollShadow visible={scrolled} />
				</View>
			</View>
		</>
	);
}

function capitalize(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A white section with a hairline edge — how the prototype sets a chart apart
 *  from the grey panels inside it. */
function Panel({ children }: { children: ReactNode }) {
	return <View className="rounded-3xl border border-border bg-background p-4">{children}</View>;
}

function PanelTitle({ title, subtitle }: { title: string; subtitle?: string }) {
	const { tf } = useFont();
	return (
		<View className="flex-1">
			<Text accessibilityRole="header" className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
				{title}
			</Text>
			{!!subtitle && (
				<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs, marginTop: 2 }}>
					{subtitle}
				</Text>
			)}
		</View>
	);
}

/** The grey box under a chart that spells out its picked column. */
function DetailBox({ children }: { children: ReactNode }) {
	return (
		<View className="rounded-[18px] bg-card" style={{ marginTop: 12, paddingHorizontal: 14, paddingVertical: 12 }}>
			{children}
		</View>
	);
}

function Hint({ text }: { text: string }) {
	const { tc } = useTheme();
	const { tf } = useFont();
	return (
		<View className="flex-row items-center" style={{ gap: 8 }}>
			<Ionicons name="locate-outline" size={16} color={tc.mutedForeground} />
			<Text className="flex-1 font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 0.5 }}>
				{text}
			</Text>
		</View>
	);
}

/**
 * Moves the period one month or year at a time, between the ledger's first
 * entry and today. Tapping the label goes back to the current one.
 */
function PeriodNav({
	label,
	accessibilityLabel,
	unitWord,
	canPrev,
	canNext,
	onStep,
	onReset,
}: {
	label: string;
	accessibilityLabel: string;
	unitWord: "oy" | "yil";
	canPrev: boolean;
	canNext: boolean;
	onStep: (delta: number) => void;
	onReset: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const step = (delta: number, enabled: boolean, name: string) => (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={name}
			accessibilityState={{ disabled: !enabled }}
			disabled={!enabled}
			onPress={() => onStep(delta)}
			hitSlop={6}
			className="items-center justify-center rounded-full bg-muted active:opacity-60"
			style={{ width: 34, height: 34, opacity: enabled ? 1 : 0.35 }}
		>
			<Ionicons name={delta < 0 ? "chevron-back" : "chevron-forward"} size={18} color={tc.foreground} />
		</Pressable>
	);

	return (
		<View className="flex-row items-center justify-between" style={{ gap: 4 }}>
			{step(-1, canPrev, unitWord === "oy" ? "Oldingi oy" : "Oldingi yil")}
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${accessibilityLabel}. Shu ${unitWord}ga o'tish`}
				onPress={onReset}
				className="flex-1 items-center active:opacity-60"
			>
				<Text
					className="font-extrabold text-foreground"
					style={{ fontSize: tf.sm, letterSpacing: -0.1 }}
					numberOfLines={1}
					adjustsFontSizeToFit
				>
					{label}
				</Text>
			</Pressable>
			{step(1, canNext, unitWord === "oy" ? "Keyingi oy" : "Keyingi yil")}
		</View>
	);
}

function SummaryCell({
	label,
	value,
	dot,
	color,
	divider = false,
}: {
	label: string;
	value: string;
	dot?: string;
	color?: string;
	divider?: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	return (
		<View
			className={`flex-1 items-center px-1 ${divider ? "border-l border-border" : ""}`}
			style={{ gap: 2 }}
		>
			<View className="flex-row items-center" style={{ gap: 5 }}>
				{!!dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
				<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.xs }}>
					{label}
				</Text>
			</View>
			<Text
				className="font-extrabold"
				style={{ fontSize: tf.sm + 1, color: color ?? tc.foreground }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{value}
			</Text>
		</View>
	);
}

function LegendKey({ color, label }: { color: string; label: string }) {
	const { tf } = useFont();
	return (
		<View className="flex-row items-center" style={{ gap: 6 }}>
			<View style={{ width: 12, height: 3, borderRadius: 2, backgroundColor: color }} />
			<Text className="font-bold text-secondary-foreground" style={{ fontSize: tf.sm - 0.5 }}>
				{label}
			</Text>
		</View>
	);
}

/** One of the three figures in the dynamics' detail box, with how it moved. */
function DetailFigure({
	label,
	value,
	color,
	delta,
	deltaColor,
}: {
	label: string;
	value: string;
	color?: string;
	/** Undefined when there's nothing to compare with; null when it's hidden. */
	delta?: number | null;
	deltaColor: (delta: number) => string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	return (
		<View className="flex-1" style={{ gap: 1 }}>
			<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs }}>
				{label}
			</Text>
			<Text
				className="font-extrabold"
				style={{ fontSize: tf.sm, color: color ?? tc.foreground }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{value}
			</Text>
			{delta !== undefined && (
				<Text
					className="font-bold"
					style={{ fontSize: tf.xs, color: delta === null ? tc.placeholder : deltaColor(delta) }}
				>
					{delta === null ? " " : signedPercent(delta)}
				</Text>
			)}
		</View>
	);
}

/** How the total moved, as an arrow, a percentage and what it's set against.
 *  Its colour says whether that's good news; the arrow carries the direction
 *  on its own, so the colour is never read alone. */
function ChangeBadge({ change, label, color }: { change: number; label: string; color: string }) {
	const { isDark } = useTheme();
	const { tf } = useFont();
	const flat = percent(change) === "0%";
	return (
		<View
			className="flex-row items-center rounded-full"
			style={{
				height: 24,
				paddingHorizontal: 9,
				gap: 4,
				backgroundColor: softTint(color, isDark),
			}}
		>
			{!flat && <Ionicons name={change > 0 ? "arrow-up" : "arrow-down"} size={12} color={color} />}
			<Text className="font-extrabold" style={{ fontSize: tf.xs, color }} numberOfLines={1}>
				{`${flat ? "0%" : percent(change)} ${label}`}
			</Text>
		</View>
	);
}

/**
 * One ranked row: the category's icon with its colour as a dot (a wallet as
 * its own tile), the name and amount, and under them a bar measured against
 * the biggest row, the share of the total, and the move against the period
 * before. A row that opens up says so with a chevron.
 */
function RankRow({
	row,
	max,
	color,
	amount,
	changeColor,
	active,
	onPress,
}: {
	row: Row;
	max: number;
	/** Resolved hex. */
	color: string;
	amount: string;
	changeColor: string;
	active: boolean;
	onPress: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const share = row.share < 0.01 ? "<1%" : percent(row.share);
	const moved =
		row.change === null
			? ""
			: percent(row.change) === "0%"
				? "0%"
				: `${row.change > 0 ? "↑" : "↓"} ${percent(row.change)}`;

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={row.drill ? undefined : { selected: active }}
			accessibilityLabel={[row.name, row.context, amount, `${share}`, moved || null, row.drill ? "ichini ochish" : null]
				.filter(Boolean)
				.join(", ")}
			onPress={onPress}
			className="flex-row items-center rounded-2xl active:opacity-70"
			style={{ padding: 8, gap: 12, backgroundColor: active ? tc.card : "transparent" }}
		>
			<View>
				{row.kind === "wallet" ? (
					<WalletIcon icon={row.icon} color={row.color ?? "blue"} size={40} />
				) : (
					<>
						<CategoryAvatar icon={row.icon ?? "help-outline"} color={row.color ?? "blue"} mono />
						<View
							style={{
								position: "absolute",
								right: -3,
								bottom: -3,
								width: 12,
								height: 12,
								borderRadius: 6,
								borderWidth: 2,
								borderColor: active ? tc.card : tc.background,
								backgroundColor: color,
							}}
						/>
					</>
				)}
			</View>
			<View className="flex-1" style={{ gap: 5 }}>
				<View className="flex-row items-baseline justify-between" style={{ gap: 8 }}>
					<Text className="flex-1 font-bold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1}>
						{row.name}
						{!!row.context && (
							<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm }}>
								{` · ${row.context}`}
							</Text>
						)}
					</Text>
					<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1}>
						{amount}
					</Text>
				</View>
				<View className="flex-row items-center" style={{ gap: 8 }}>
					<View className="flex-1 rounded-full overflow-hidden bg-muted" style={{ height: 6 }}>
						<View
							style={{
								// A zero-width bar reads as a rendering bug; a hairline reads
								// as "almost nothing", which is the truth.
								width: `${Math.max(2, max > 0 ? (row.amount / max) * 100 : 0)}%`,
								height: 6,
								borderRadius: 3,
								backgroundColor: color,
							}}
						/>
					</View>
					<Text className="font-bold text-muted-foreground text-right" style={{ fontSize: tf.xs, width: 40 }}>
						{share}
					</Text>
					<Text className="font-extrabold text-right" style={{ fontSize: tf.xs, width: 50, color: changeColor }} numberOfLines={1}>
						{moved}
					</Text>
				</View>
			</View>
			{!!row.drill && <Ionicons name="chevron-forward" size={18} color={tc.placeholder} />}
		</Pressable>
	);
}

/** One line of "what stands out", with an icon tile saying what kind it is. */
function InsightRow({
	insight,
	first,
	side,
	money,
	comparedTo,
}: {
	insight: Insight;
	first: boolean;
	side: TxType;
	money: (amount: number) => string;
	comparedTo: string;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const expense = side === "expense";

	let icon: IconName;
	let color: string;
	let title: string;
	let text: string;
	switch (insight.kind) {
		case "rise":
			icon = "trending-up";
			color = expense ? tc.danger : tc.success;
			title = "Eng ko'p o'sgan";
			text = `${insight.row.name}: ${money(insight.row.amount)} (${signedPercent(insight.row.change)} ${comparedTo})`;
			break;
		case "fall":
			icon = "trending-down";
			color = expense ? tc.success : tc.danger;
			title = "Eng ko'p kamaygan";
			text = `${insight.row.name}: ${money(insight.row.amount)} (${signedPercent(insight.row.change)})`;
			break;
		case "peak":
			icon = "calendar-outline";
			color = categoryColorValue("blue", isDark);
			title = expense ? `Eng qimmat ${insight.column.unit}` : `Eng ko'p kirim bo'lgan ${insight.column.unit}`;
			text = `${insight.column.title}: ${money(insight.amount)}${
				insight.lead ? ` · asosan ${insight.lead.toLowerCase()}` : ""
			}`;
			break;
		case "average":
			icon = "calendar-outline";
			color = tc.mutedForeground;
			title = `${insight.per === "day" ? "Kunlik" : "Oylik"} o'rtacha ${expense ? "chiqim" : "kirim"}`;
			text = money(insight.amount);
			break;
	}

	return (
		<View
			className={`flex-row items-start ${first ? "" : "border-t border-border"}`}
			style={{ gap: 10, paddingVertical: 10 }}
		>
			<View
				className="items-center justify-center"
				style={{ width: 32, height: 32, borderRadius: 11, backgroundColor: softTint(color, isDark) }}
			>
				<Ionicons name={icon} size={16} color={color} />
			</View>
			<View className="flex-1" style={{ gap: 1 }}>
				<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.xs }}>
					{title}
				</Text>
				<Text className="font-bold text-foreground" style={{ fontSize: tf.sm + 1, lineHeight: Math.round((tf.sm + 1) * 1.35) }}>
					{text}
				</Text>
			</View>
		</View>
	);
}
