import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import BalanceCard from "@/components/BalanceCard";
import MonthSwitcher from "@/components/MonthSwitcher";
import PeriodSummary from "@/components/PeriodSummary";
import StatRow from "@/components/StatRow";
import TabHeader from "@/components/TabHeader";
import { Button, Card, IconButton, PillTabs } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, formatLongDate, monthName, todayISO } from "@/lib/date";
import { excludeDebts, inMonth, inUnit, ofType, unitsUsed } from "@/lib/ledger";
import { breakdown, periodSummary, sliceColor } from "@/lib/stats";
import { walletBalances, walletUnitsUsed } from "@/lib/wallets";
import "../../global.css";

/** Categories the dashboard previews — the rest are a tap away on Stats. */
const TOP_CATEGORIES = 3;

/**
 * The dashboard, top to bottom in the order the questions come: how much do I
 * have, how is this month going, and where is it going. Adding an entry —
 * the thing done most — floats at the bottom so it never scrolls away.
 */
export default function DashboardScreen() {
	const router = useRouter();
	const { goToTab } = useTabNavigation();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("home");
	const { ready, transactions, categories, wallets, transfers, defaultUnit } = useLedger();
	const { hideIncome, toggleHideIncome, includeDebtsInStats } = usePreferences();

	const [month, setMonth] = useState(currentMonthKey);
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [pickedWalletUnit, setPickedWalletUnit] = useState<string | null>(null);

	// Amounts in different units can't be added up, so the month reports one
	// unit at a time: the user's default when the month contains it, otherwise
	// the busiest unit in the month. The chooser only appears when there's an
	// actual choice to make.
	const units = useMemo(() => unitsUsed(inMonth(transactions, month)), [transactions, month]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: (units[0] ?? defaultUnit);

	// Debt categories (borrowing, lending, collection, repayment) are money
	// moving against a debt, not real income or spending — left out of every
	// stat below unless the user opts back in from Settings. Kept across all
	// months, not just this one: the summary compares against the last.
	const relevant = useMemo(() => {
		const scoped = inUnit(transactions, unit);
		return includeDebtsInStats ? scoped : excludeDebts(scoped);
	}, [transactions, unit, includeDebtsInStats]);

	const summary = useMemo(() => periodSummary(relevant, "month", month), [relevant, month]);
	const topCategories = useMemo(
		() =>
			breakdown(ofType(inMonth(relevant, month), "expense"), categories, "category").slice(
				0,
				TOP_CATEGORIES,
			),
		[relevant, month, categories],
	);

	// The wallet card is deliberately independent of the month below it: what
	// a jar holds is an all-time running balance, not something a month resets,
	// so it picks its own unit from everything the wallets have ever touched
	// rather than from whichever month happens to be showing.
	const walletUnits = useMemo(() => {
		const used = walletUnitsUsed(transactions, transfers);
		return used.length > 0 ? used : [defaultUnit];
	}, [transactions, transfers, defaultUnit]);
	const walletUnit =
		pickedWalletUnit && walletUnits.includes(pickedWalletUnit)
			? pickedWalletUnit
			: walletUnits.includes(defaultUnit)
				? defaultUnit
				: walletUnits[0];

	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, walletUnit),
		[transactions, transfers, wallets, walletUnit],
	);

	if (!ready) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title="Asosiy" />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<TabHeader
				title="Asosiy"
				subtitle={formatLongDate(todayISO())}
				headerRight={
					<View className="flex-row items-center gap-1">
						<IconButton
							icon={hideIncome ? "eye-off-outline" : "eye-outline"}
							accessibilityLabel={hideIncome ? "Kirimni ko'rsatish" : "Kirimni yashirish"}
							onPress={toggleHideIncome}
						/>
						<IconButton
							icon="settings-outline"
							accessibilityLabel="Sozlamalar"
							onPress={() => router.push("/settings")}
						/>
					</View>
				}
			/>
			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 96 }}
				showsVerticalScrollIndicator={false}
			>
				<BalanceCard
					balances={balances}
					unit={walletUnit}
					units={walletUnits}
					onUnitChange={setPickedWalletUnit}
					hide={hideIncome}
					onOpen={() => router.push("/wallets")}
				/>

				<PeriodSummary
					summary={summary}
					unit={unit}
					span="month"
					hideIncome={hideIncome}
					onPressSide={goToTab}
					header={
						<>
							<MonthSwitcher value={month} onChange={setMonth} />
							{units.length > 1 && (
								<PillTabs
									compact
									fill
									className="mt-2"
									items={units.map((code) => ({ key: code, label: code }))}
									value={unit}
									onChange={setPickedUnit}
								/>
							)}
						</>
					}
				/>

				<Card title="Eng ko'p xarajat" subtitle={`${monthName(month)} · kategoriyalar bo'yicha`}>
					{topCategories.length === 0 ? (
						<Text className="text-muted-foreground py-2" style={{ fontSize: tf.sm }}>
							{"Bu oyda chiqim yo'q."}
						</Text>
					) : (
						<View className="gap-4">
							{topCategories.map((slice) => (
								<StatRow
									key={slice.key}
									name={slice.name}
									icon={slice.icon ?? "pricetag-outline"}
									color={sliceColor(slice.key, slice.color, isDark, tc.mutedForeground)}
									amount={slice.amount}
									share={slice.share}
									unit={unit}
									mask={false}
								/>
							))}
						</View>
					)}
					<View className="mt-4">
						<Button
							label="Batafsil statistika"
							variant="soft"
							fullWidth
							startIcon={<Ionicons name="stats-chart-outline" size={18} color={tc.primary} />}
							onPress={() => router.push(`/stats?month=${month}`)}
						/>
					</View>
				</Card>
			</ScrollView>

			{/* The most common thing done here, so it floats rather than scrolls —
			    the same pair of pills the Debts tab uses. Expense sits on the
			    right, nearest the thumb, because it's the one added most. */}
			<View className="absolute right-4 bottom-4 flex-row gap-2">
				<Button
					label="Kirim"
					shape="pill"
					color="success"
					startIcon={<Ionicons name="add" size={20} color="#fff" />}
					onPress={() => router.push("/transaction?type=income")}
					accessibilityLabel="Kirim qo'shish"
				/>
				<Button
					label="Chiqim"
					shape="pill"
					color="danger"
					startIcon={<Ionicons name="add" size={20} color="#fff" />}
					onPress={() => router.push("/transaction?type=expense")}
					accessibilityLabel="Chiqim qo'shish"
				/>
			</View>
		</View>
	);
}
