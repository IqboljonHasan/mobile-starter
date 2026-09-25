import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import BarChart from "@/components/BarChart";
import BreakdownStats from "@/components/BreakdownStats";
import { Card, SegmentedControl } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { lastMonthKeys, lastYearKeys } from "@/lib/date";
import { excludeDebts, inUnit, ofType, sum, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import { monthlyTotals, TREND_MONTHS, TREND_YEARS, yearlyTotals } from "@/lib/stats";
import "../global.css";

type TrendSpan = "month" | "year";

/**
 * Every angle on the ledger the dashboard doesn't have room for: totals across
 * all time, a trend of income vs. expense over the trailing months or years,
 * and a breakdown by category or subcategory for any month or year, drawn as
 * a pie, ranked bars, or a trend as the user picks — the same numbers
 * the dashboard's month card and the Kirim/Chiqim tabs already compute,
 * gathered onto one screen instead of a card the dashboard had to keep small.
 */
export default function StatsScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { ready, transactions, categories, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats } = usePreferences();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [trendSpan, setTrendSpan] = useState<TrendSpan>("month");

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

	const trendPeriods = useMemo(
		() =>
			trendSpan === "month"
				? monthlyTotals(transactions, lastMonthKeys(TREND_MONTHS), unit, includeDebtsInStats)
				: yearlyTotals(transactions, lastYearKeys(TREND_YEARS), unit, includeDebtsInStats),
		[transactions, trendSpan, unit, includeDebtsInStats],
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
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{units.length > 1 && (
					<View className="flex-row flex-wrap gap-2">
						{units.map((code) => {
							const active = code === unit;
							return (
								<Pressable
									key={code}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
									onPress={() => setPickedUnit(code)}
									className={`px-3 py-1.5 rounded-full active:opacity-70 ${
										active ? "bg-primary-highlight" : "bg-card"
									}`}
								>
									<Text
										className={`font-semibold ${
											active ? "text-primary" : "text-muted-foreground"
										}`}
										style={{ fontSize: tf.sm }}
									>
										{code}
									</Text>
								</Pressable>
							);
						})}
					</View>
				)}

				{/* Overall ------------------------------------------------------- */}
				<Card title="Umumiy" subtitle="Butun tarix bo'yicha">
					<View className="flex-row">
						<Summary
							label="Kirim"
							amount={allTimeIncome}
							unit={unit}
							hide={hideIncome}
							tone="success"
						/>
						<View className="w-px bg-border" />
						<Summary
							label="Chiqim"
							amount={allTimeExpense}
							unit={unit}
							hide={false}
							tone="danger"
						/>
						<View className="w-px bg-border" />
						<Summary
							label="Sof"
							amount={allTimeNet}
							unit={unit}
							hide={hideIncome}
							tone={allTimeNet >= 0 ? "success" : "danger"}
						/>
					</View>
				</Card>

				{/* Trend ----------------------------------------------------------- */}
				<Card
					title="Tendensiya"
					subtitle={
						trendSpan === "month"
							? `Oxirgi ${TREND_MONTHS} oy`
							: `Oxirgi ${TREND_YEARS} yil`
					}
				>
					<SegmentedControl
						items={[
							{ key: "month", label: "Oylik" },
							{ key: "year", label: "Yillik" },
						]}
						value={trendSpan}
						onChange={(key) => setTrendSpan(key as TrendSpan)}
						className="bg-muted mb-4"
					/>
					<BarChart periods={trendPeriods} />
				</Card>

				{/* Breakdown ------------------------------------------------------ */}
				<BreakdownStats
					transactions={relevant}
					categories={categories}
					unit={unit}
					hideIncome={hideIncome}
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
	tone,
}: {
	label: string;
	amount: number;
	unit: string;
	hide: boolean;
	tone: "success" | "danger";
}) {
	const { tf } = useFont();
	return (
		<View className="flex-1 items-center px-1">
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
			<Text
				className={`font-bold mt-1 ${tone === "success" ? "text-success" : "text-danger"}`}
				style={{ fontSize: tf.lg }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{hide ? maskAmount(unit) : formatAmount(amount, unit)}
			</Text>
		</View>
	);
}
