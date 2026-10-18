import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import BarChart from "@/components/BarChart";
import BreakdownStats from "@/components/BreakdownStats";
import MonthSwitcher from "@/components/MonthSwitcher";
import PeriodSummary from "@/components/PeriodSummary";
import WalletBalanceStats from "@/components/WalletBalanceStats";
import YearSwitcher from "@/components/YearSwitcher";
import { Card, PillTabs } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, currentYearKey, yearKeyOf } from "@/lib/date";
import { excludeDebts, inUnit, ofType, sum, unitsUsed } from "@/lib/ledger";
import { monthlyTotals, periodSummary, type Span, TREND_MONTHS, trendMonths } from "@/lib/stats";
import type { TxType } from "@/lib/types";
import { walletBalances } from "@/lib/wallets";
import "../global.css";

/** The month Home was showing when it opened this screen, if it's a real one. */
function initialMonth(param: string | undefined): string {
	const now = currentMonthKey();
	return param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) && param <= now ? param : now;
}

/**
 * Every angle on the ledger the dashboard doesn't have room for.
 *
 * One picked month or year scopes the screen, from a bar pinned under the
 * header so it stays in reach however far down the breakdown runs. Under it,
 * in the order the questions come: how the period went and how that moved
 * against the one before, the income-vs-expense run around it — whose columns
 * double as a way to pick a month — and where the money went, by category or
 * subcategory. Below a divider sits what no period scopes: all-time totals
 * and where the money sits across the wallets.
 */
export default function StatsScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ month?: string }>();
	const { ready, transactions, categories, wallets, transfers, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats } = usePreferences();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [span, setSpan] = useState<Span>("month");
	const [month, setMonth] = useState(() => initialMonth(params.month));
	const [year, setYear] = useState(() => yearKeyOf(initialMonth(params.month)));
	const [trendFocus, setTrendFocus] = useState<TxType | null>(null);
	const [scrolled, setScrolled] = useState(false);

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

	const scoped = useMemo(() => inUnit(transactions, unit), [transactions, unit]);
	const relevant = useMemo(
		() => (includeDebtsInStats ? scoped : excludeDebts(scoped)),
		[scoped, includeDebtsInStats],
	);

	const allTimeIncome = useMemo(() => sum(ofType(relevant, "income")), [relevant]);
	const allTimeExpense = useMemo(() => sum(ofType(relevant, "expense")), [relevant]);
	const allTimeNet = allTimeIncome - allTimeExpense;

	const summary = useMemo(
		() => periodSummary(relevant, span, span === "month" ? month : year),
		[relevant, span, month, year],
	);
	const trendPeriods = useMemo(
		() => monthlyTotals(transactions, trendMonths(span, month, year), unit, includeDebtsInStats),
		[transactions, span, month, year, unit, includeDebtsInStats],
	);

	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, unit),
		[transactions, transfers, wallets, unit],
	);

	// Switching between a month and a year keeps the user's place: a month
	// opens onto its own year, and a year onto its latest month that has begun.
	const changeSpan = (next: Span) => {
		if (next === "year") setYear(yearKeyOf(month));
		else if (yearKeyOf(month) !== year) {
			setMonth(year === currentYearKey() ? currentMonthKey() : `${year}-12`);
		}
		setSpan(next);
	};

	// A column opens its month — from a year view, that's a step down into it.
	const openMonth = (key: string) => {
		setMonth(key);
		setSpan("month");
	};

	if (!ready) {
		return (
			<>
				<Stack.Screen options={{ title: "Statistika" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</>
		);
	}

	return (
		<>
			<Stack.Screen options={{ title: "Statistika" }} />
			<View className="flex-1 bg-background">
				{/* Period: scopes everything above the divider ------------------- */}
				<View
					className="bg-card px-4 pb-3 gap-3"
					style={
						scrolled
							? {
									shadowColor: "#000",
									shadowOffset: { width: 0, height: 2 },
									shadowOpacity: 0.08,
									shadowRadius: 6,
									elevation: 8,
									zIndex: 10,
								}
							: undefined
					}
				>
					<View className="flex-row items-center gap-3">
						<PillTabs
							variant="inverse"
							items={[
								{ key: "month", label: "Oy" },
								{ key: "year", label: "Yil" },
							]}
							value={span}
							onChange={changeSpan}
						/>
						<View className="flex-1">
							{span === "month" ? (
								<MonthSwitcher value={month} onChange={setMonth} />
							) : (
								<YearSwitcher value={year} onChange={setYear} />
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
				</View>

				<ScrollView
					className="flex-1"
					contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
					scrollEventThrottle={16}
					onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > 4)}
				>
					<PeriodSummary summary={summary} unit={unit} span={span} hideIncome={hideIncome} />

					<Card
						title="Kirim va chiqim"
						subtitle={`${
							span === "month" ? `So'nggi ${TREND_MONTHS} oy` : `${year}-yil oylari`
						} · oyni ochish uchun ustunni bosing`}
					>
						<BarChart
							periods={trendPeriods}
							unit={unit}
							hideIncome={hideIncome}
							focus={trendFocus}
							onFocusChange={setTrendFocus}
							selected={span === "month" ? month : null}
							onSelect={openMonth}
						/>
					</Card>

					<BreakdownStats
						transactions={relevant}
						categories={categories}
						unit={unit}
						hideIncome={hideIncome}
						span={span}
						month={month}
						year={year}
					/>

					{/* All time: the period above doesn't reach these --------------- */}
					<View className="flex-row items-center gap-3 mt-4">
						<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm }}>
							{"Butun tarix bo'yicha"}
						</Text>
						<View className="flex-1 h-px bg-border" />
					</View>

					<Card title="Umumiy">
						<View className="flex-row">
							<Summary
								label="Kirim"
								amount={allTimeIncome}
								unit={unit}
								hide={hideIncome}
								color={tc.success}
							/>
							<View className="w-px bg-border" />
							<Summary
								label="Chiqim"
								amount={allTimeExpense}
								unit={unit}
								hide={false}
								color={tc.danger}
							/>
							<View className="w-px bg-border" />
							<Summary
								label="Foyda"
								amount={allTimeNet}
								unit={unit}
								hide={hideIncome}
								color={allTimeNet >= 0 ? tc.success : tc.danger}
							/>
						</View>
					</Card>

					<WalletBalanceStats balances={balances} unit={unit} hide={hideIncome} />
				</ScrollView>
			</View>
		</>
	);
}

function Summary({
	label,
	amount,
	unit,
	hide,
	color,
}: {
	label: string;
	amount: number;
	unit: string;
	hide: boolean;
	color: string;
}) {
	const { tf } = useFont();
	return (
		<View className="flex-1 items-center px-1">
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
			<AmountText
				amount={amount}
				unit={unit}
				size={tf.lg}
				mask={hide}
				color={color}
				fit
				style={{ marginTop: 4 }}
			/>
		</View>
	);
}
