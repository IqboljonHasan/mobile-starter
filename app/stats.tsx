import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import BarChart from "@/components/BarChart";
import BreakdownStats, { type Span } from "@/components/BreakdownStats";
import MonthSwitcher from "@/components/MonthSwitcher";
import WalletBalanceStats from "@/components/WalletBalanceStats";
import YearSwitcher from "@/components/YearSwitcher";
import { Card, CollapsibleCard, PillTabs } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, currentYearKey, lastMonthKeys, lastYearKeys } from "@/lib/date";
import { excludeDebts, inUnit, ofType, sum, unitsUsed } from "@/lib/ledger";
import type { TxType } from "@/lib/types";
import { walletBalances } from "@/lib/wallets";
import { monthlyTotals, TREND_MONTHS, TREND_YEARS, yearlyTotals } from "@/lib/stats";
import "../global.css";

/**
 * Every angle on the ledger the dashboard doesn't have room for. The top is
 * about the ledger as a whole — all-time totals and where the money sits
 * across the wallets — folded away until asked for. Below them one picked
 * month or year drives the rest: the income-vs-expense run leading up to it,
 * and its breakdown by category or subcategory, drawn as ranked bars, a pie,
 * or a trend.
 */
export default function StatsScreen() {
	const { tc } = useTheme();
	const { ready, transactions, categories, wallets, transfers, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats } = usePreferences();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [span, setSpan] = useState<Span>("month");
	const [month, setMonth] = useState(currentMonthKey);
	const [year, setYear] = useState(currentYearKey);
	const [trendSpan, setTrendSpan] = useState<Span>("month");
	const [trendFocus, setTrendFocus] = useState<TxType | null>(null);

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

	// Its own month/year switch, but still ending at the period picked above
	// it: the month itself, or — when a year is picked — that year's last month
	// (today, for the current year). A picked month ends a yearly trend at its year.
	const trendPeriods = useMemo(() => {
		if (trendSpan === "month") {
			const now = currentMonthKey();
			const end = span === "month" ? month : `${year}-12` < now ? `${year}-12` : now;
			return monthlyTotals(
				transactions,
				lastMonthKeys(TREND_MONTHS, end),
				unit,
				includeDebtsInStats,
			);
		}
		const end = span === "year" ? year : month.slice(0, 4);
		return yearlyTotals(transactions, lastYearKeys(TREND_YEARS, end), unit, includeDebtsInStats);
	}, [transactions, trendSpan, span, month, year, unit, includeDebtsInStats]);

	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, unit),
		[transactions, transfers, wallets, unit],
	);

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
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{units.length > 1 && (
					<PillTabs
						items={units.map((code) => ({ key: code, label: code }))}
						value={unit}
						onChange={setPickedUnit}
					/>
				)}

				{/* Overall ------------------------------------------------------- */}
				<CollapsibleCard title="Umumiy" subtitle="Butun tarix bo'yicha">
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
				</CollapsibleCard>

				{/* Wallet balances ------------------------------------------------ */}
				<WalletBalanceStats balances={balances} unit={unit} hide={hideIncome} />

				

				{/* Trend ----------------------------------------------------------- */}
				<Card
					title="Kirim-chiqim tendensiyasi"
					subtitle={
						trendSpan === "month"
							? `So'nggi ${TREND_MONTHS} oy`
							: `Oxirgi ${TREND_YEARS} yil`
					}
					headerRight={
						<PillTabs
							compact
							items={[
								{ key: "month", label: "Oylik" },
								{ key: "year", label: "Yillik" },
							]}
							value={trendSpan}
							onChange={setTrendSpan}
						/>
					}
				>
					<View className="mt-2">
						<BarChart
							periods={trendPeriods}
							focus={trendFocus}
							onFocusChange={setTrendFocus}
						/>
					</View>
				</Card>

				{/* Period: drives the trend and the breakdown below ---------------- */}
				<View className="flex-row gap-3 mt-2">
					<View
						className="flex-1 rounded-2xl bg-card px-1 justify-center"
						style={{ minHeight: 52 }}
					>
						{span === "month" ? (
							<MonthSwitcher value={month} onChange={setMonth} />
						) : (
							<YearSwitcher value={year} onChange={setYear} />
						)}
					</View>
					<PillTabs
						stretch
						items={[
							{ key: "month", label: "Oylik" },
							{ key: "year", label: "Yillik" },
						]}
						value={span}
						onChange={setSpan}
					/>
				</View>

				{/* Side, chart, and the breakdown by category ---------------------- */}
				<BreakdownStats
					transactions={relevant}
					categories={categories}
					unit={unit}
					hideIncome={hideIncome}
					span={span}
					month={month}
					year={year}
				/>
			</ScrollView>
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
