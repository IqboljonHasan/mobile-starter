import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import MonthSwitcher from "@/components/MonthSwitcher";
import TabHeader from "@/components/TabHeader";
import { Button, Card, IconButton } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { currentMonthKey } from "@/lib/date";
import { excludeDebts, inMonth, inUnit, ofType, sum, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import { walletBalances, walletUnitsUsed } from "@/lib/wallets";
import "../../global.css";

export default function DashboardScreen() {
	const router = useRouter();
	const { goToTab } = useTabNavigation();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("home");
	const { ready, transactions, wallets, transfers, defaultUnit } = useLedger();
	const { hideIncome, toggleHideIncome, includeDebtsInStats } = usePreferences();

	const [month, setMonth] = useState(currentMonthKey);
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [pickedWalletUnit, setPickedWalletUnit] = useState<string | null>(null);

	const monthTransactions = useMemo(
		() => inMonth(transactions, month),
		[transactions, month],
	);

	// Amounts in different units can't be added up, so the dashboard reports one
	// unit at a time: the user's default when the month contains it, otherwise
	// the busiest unit in the month. The chooser only appears when there's an
	// actual choice to make.
	const units = useMemo(() => unitsUsed(monthTransactions), [monthTransactions]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: (units[0] ?? defaultUnit);

	const scoped = useMemo(() => inUnit(monthTransactions, unit), [monthTransactions, unit]);
	// Debt categories (borrowing, lending, collection, repayment) are money
	// moving against a debt, not real income or spending — left out of every
	// stat below unless the user opts back in from Settings.
	const income = useMemo(() => {
		const list = ofType(scoped, "income");
		return includeDebtsInStats ? list : excludeDebts(list);
	}, [scoped, includeDebtsInStats]);
	const expense = useMemo(() => {
		const list = ofType(scoped, "expense");
		return includeDebtsInStats ? list : excludeDebts(list);
	}, [scoped, includeDebtsInStats]);

	const incomeTotal = sum(income);
	const expenseTotal = sum(expense);
	const net = incomeTotal - expenseTotal;

	// The wallet section is deliberately independent of the month above it: what
	// a jar holds is an all-time running balance, not something a month resets,
	// so it picks its own unit from everything the wallets have ever touched
	// rather than from whichever month happens to be showing below.
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
	// Everything the user holds, jars and the unallocated pool alike — a
	// transfer moves money between rows without changing this sum, so it's
	// exactly all-time income minus all-time expense in this unit.
	const totalBalance = useMemo(
		() => balances.reduce((acc, b) => acc + b.balance, 0),
		[balances],
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
				subtitle="Kirim va chiqim bir qarashda"
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
				contentContainerStyle={{ padding: 16, gap: 12 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Wallets ----------------------------------------------------- */}
				<Card
					title="Hamyonlar"
					subtitle="Joriy qoldiq — butun tarix bo'yicha"
					onPress={() => router.push("/wallets")}
				>
					{walletUnits.length > 1 && (
						<View className="flex-row flex-wrap gap-2 mb-1">
							{walletUnits.map((code) => {
								const active = code === walletUnit;
								return (
									<Pressable
										key={code}
										accessibilityRole="button"
										accessibilityState={{ selected: active }}
										onPress={() => setPickedWalletUnit(code)}
										className={`px-3 py-1.5 rounded-full active:opacity-70 ${
											active ? "bg-primary-highlight" : "bg-muted"
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

					<View className="items-center pb-4">
						<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
							Jami balans
						</Text>
						<Text
							className={`font-bold mt-1 ${
								totalBalance < 0 ? "text-danger" : "text-foreground"
							}`}
							style={{ fontSize: tf.xxxl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{hideIncome ? maskAmount(walletUnit) : formatAmount(totalBalance, walletUnit)}
						</Text>
					</View>

					<View className="gap-2.5">
						{balances.map((row) => (
							<View key={row.walletId} className="flex-row items-center gap-2">
								<View
									style={{
										width: 10,
										height: 10,
										borderRadius: 5,
										backgroundColor: categoryColorValue(row.color, isDark),
									}}
								/>
								<Text
									className="flex-1 text-foreground"
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{row.name}
								</Text>
								<Text
									className={`font-semibold ${
										row.balance < 0 ? "text-danger" : "text-foreground"
									}`}
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{hideIncome ? maskAmount(walletUnit) : formatAmount(row.balance, walletUnit)}
								</Text>
							</View>
						))}
					</View>
				</Card>

				{/* Month --------------------------------------------------------- */}
				<Card>
					<MonthSwitcher value={month} onChange={setMonth} />

					{units.length > 1 && (
						<View className="flex-row flex-wrap gap-2 mt-3">
							{units.map((code) => {
								const active = code === unit;
								return (
									<Pressable
										key={code}
										accessibilityRole="button"
										accessibilityState={{ selected: active }}
										onPress={() => setPickedUnit(code)}
										className={`px-3 py-1.5 rounded-full active:opacity-70 ${
											active ? "bg-primary-highlight" : "bg-muted"
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

					{/* The headline number: what the month actually did to the balance. */}
					<View className="items-center pt-5">
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							Oylik sof qoldiq
						</Text>
						<Text
							className={`font-bold mt-1 ${
								net > 0 ? "text-success" : net < 0 ? "text-danger" : "text-foreground"
							}`}
							style={{ fontSize: tf.xxxl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{hideIncome ? maskAmount(unit) : formatAmount(net, unit, { signed: true })}
						</Text>
					</View>

				</Card>

				{/* Totals ------------------------------------------------------ */}
				<View className="flex-row gap-3">
					<Card className="flex-1" onPress={() => goToTab("income")}>
						<View className="flex-row items-center gap-2">
							<Ionicons name="arrow-down-circle" size={18} color={tc.success} />
							<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
								Kirim
							</Text>
						</View>
						<Text
							className="font-bold text-foreground mt-1"
							style={{ fontSize: tf.xl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{hideIncome ? maskAmount(unit) : formatAmount(incomeTotal, unit)}
						</Text>
						<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
							{income.length} ta yozuv
						</Text>
					</Card>
					<Card className="flex-1" onPress={() => goToTab("expense")}>
						<View className="flex-row items-center gap-2">
							<Ionicons name="arrow-up-circle" size={18} color={tc.danger} />
							<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
								Chiqim
							</Text>
						</View>
						<Text
							className="font-bold text-foreground mt-1"
							style={{ fontSize: tf.xl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{formatAmount(expenseTotal, unit)}
						</Text>
						<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
							{expense.length} ta yozuv
						</Text>
					</Card>
				</View>

				{/* Quick add --------------------------------------------------- */}
				<View className="flex-row gap-3">
					<View className="flex-1">
						<Button
							label="Kirim qo'shish"
							color="success"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color="#fff" />}
							onPress={() => router.push("/transaction?type=income")}
						/>
					</View>
					<View className="flex-1">
						<Button
							label="Chiqim qo'shish"
							color="danger"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color="#fff" />}
							onPress={() => router.push("/transaction?type=expense")}
						/>
					</View>
				</View>

				{/* Stats --------------------------------------------------------- */}
				<Card onPress={() => router.push("/stats")}>
					<View className="flex-row items-center gap-3">
						<View className="w-10 h-10 rounded-full items-center justify-center bg-primary-highlight">
							<Ionicons name="stats-chart-outline" size={20} color={tc.primary} />
						</View>
						<View className="flex-1">
							<Text
								className="font-semibold text-foreground"
								style={{ fontSize: tf.lg }}
							>
								Statistika
							</Text>
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.sm }}
								numberOfLines={1}
							>
								Grafiklar, oylik/yillik tendensiya, kategoriyalar
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={18} color={tc.mutedForeground} />
					</View>
				</Card>

			</ScrollView>
		</View>
	);
}
