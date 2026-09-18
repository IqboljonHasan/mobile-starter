import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import CategoryBreakdown from "@/components/CategoryBreakdown";
import MonthSwitcher from "@/components/MonthSwitcher";
import TabHeader from "@/components/TabHeader";
import TransactionRow from "@/components/TransactionRow";
import { Button, Card, EmptyState, IconButton, SegmentedControl } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey } from "@/lib/date";
import {
	categoryBreakdown,
	inMonth,
	inUnit,
	ofType,
	sum,
	unitsUsed,
} from "@/lib/ledger";
import { formatAmount, unitByCode } from "@/lib/money";
import type { TxType } from "@/lib/types";
import "../../global.css";

export default function DashboardScreen() {
	const router = useRouter();
	const { goToTab } = useTabNavigation();
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("home");
	const { ready, transactions, categories, defaultUnit } = useLedger();

	const [month, setMonth] = useState(currentMonthKey);
	const [breakdownType, setBreakdownType] = useState<TxType>("expense");
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);

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
	const income = useMemo(() => ofType(scoped, "income"), [scoped]);
	const expense = useMemo(() => ofType(scoped, "expense"), [scoped]);

	const incomeTotal = sum(income);
	const expenseTotal = sum(expense);
	const net = incomeTotal - expenseTotal;
	const flow = incomeTotal + expenseTotal;

	const slices = useMemo(
		() => categoryBreakdown(breakdownType === "income" ? income : expense, categories),
		[breakdownType, income, expense, categories],
	);

	const recent = useMemo(
		() =>
			[...scoped]
				.sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
				.slice(0, 5),
		[scoped],
	);

	if (!ready) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title="Dashboard" />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<TabHeader
				title="Dashboard"
				subtitle="Income and spending at a glance"
				headerRight={
					<IconButton
						icon="settings-outline"
						accessibilityLabel="Settings"
						onPress={() => router.push("/settings")}
					/>
				}
			/>
			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12 }}
				showsVerticalScrollIndicator={false}
			>
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
					<View className="items-center py-5">
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							Net this month
						</Text>
						<Text
							className={`font-bold mt-1 ${
								net > 0 ? "text-success" : net < 0 ? "text-danger" : "text-foreground"
							}`}
							style={{ fontSize: tf.xxxl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{formatAmount(net, unit, { signed: true })}
						</Text>
						<Text
							className="text-muted-foreground mt-1"
							style={{ fontSize: tf.xs }}
						>
							{unitByCode(unit).name}
						</Text>
					</View>

					{/* Two series, so both are labelled — the bar shows the split, the
					    labels say which is which and by how much. */}
					{flow > 0 && (
						<>
							<View className="flex-row gap-0.5" style={{ height: 10 }}>
								<View
									style={{
										flex: Math.max(incomeTotal, 0.0001),
										backgroundColor: tc.success,
										borderRadius: 5,
									}}
								/>
								<View
									style={{
										flex: Math.max(expenseTotal, 0.0001),
										backgroundColor: tc.danger,
										borderRadius: 5,
									}}
								/>
							</View>
							<View className="flex-row justify-between mt-2">
								<Text className="text-success font-semibold" style={{ fontSize: tf.sm }}>
									In {Math.round((incomeTotal / flow) * 100)}%
								</Text>
								<Text className="text-danger font-semibold" style={{ fontSize: tf.sm }}>
									Out {Math.round((expenseTotal / flow) * 100)}%
								</Text>
							</View>
						</>
					)}
				</Card>

				{/* Totals ------------------------------------------------------ */}
				<View className="flex-row gap-3">
					<Card className="flex-1" onPress={() => goToTab("income")}>
						<View className="flex-row items-center gap-2">
							<Ionicons name="arrow-down-circle" size={18} color={tc.success} />
							<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
								Income
							</Text>
						</View>
						<Text
							className="font-bold text-foreground mt-1"
							style={{ fontSize: tf.xl }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{formatAmount(incomeTotal, unit)}
						</Text>
						<Text className="text-muted-foreground" style={{ fontSize: tf.xs }}>
							{income.length} {income.length === 1 ? "entry" : "entries"}
						</Text>
					</Card>
					<Card className="flex-1" onPress={() => goToTab("expense")}>
						<View className="flex-row items-center gap-2">
							<Ionicons name="arrow-up-circle" size={18} color={tc.danger} />
							<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
								Expense
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
							{expense.length} {expense.length === 1 ? "entry" : "entries"}
						</Text>
					</Card>
				</View>

				{/* Quick add --------------------------------------------------- */}
				<View className="flex-row gap-3">
					<View className="flex-1">
						<Button
							label="Add income"
							color="success"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color="#fff" />}
							onPress={() => router.push("/transaction?type=income")}
						/>
					</View>
					<View className="flex-1">
						<Button
							label="Add expense"
							color="danger"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color="#fff" />}
							onPress={() => router.push("/transaction?type=expense")}
						/>
					</View>
				</View>

				{/* Breakdown --------------------------------------------------- */}
				<Card title="By category">
					<SegmentedControl
						items={[
							{ key: "expense", label: "Expense" },
							{ key: "income", label: "Income" },
						]}
						value={breakdownType}
						onChange={(key) => setBreakdownType(key as TxType)}
						className="bg-muted mb-4"
					/>
					{slices.length === 0 ? (
						<Text
							className="text-muted-foreground text-center py-6"
							style={{ fontSize: tf.base }}
						>
							Nothing recorded this month.
						</Text>
					) : (
						<CategoryBreakdown slices={slices} unit={unit} />
					)}
				</Card>

				{/* Recent ------------------------------------------------------ */}
				<Card
					flush
					title="Recent"
					headerRight={
						recent.length > 0 ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => goToTab("expense")}
								className="px-3 py-1.5 rounded-full bg-muted active:opacity-70"
							>
								<Text
									className="font-medium text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									See all
								</Text>
							</Pressable>
						) : undefined
					}
				>
					{recent.length === 0 ? (
						<EmptyState
							icon="receipt-outline"
							title="No entries yet"
							message="Record what you earn and spend, and this month will fill in."
							actionLabel="Add an expense"
							onAction={() => router.push("/transaction?type=expense")}
						/>
					) : (
						recent.map((transaction, i) => (
							<TransactionRow
								key={transaction.id}
								transaction={transaction}
								categories={categories}
								divider={i > 0}
								showDate
								onPress={() => router.push(`/transaction?id=${transaction.id}`)}
							/>
						))
					)}
				</Card>

				<Card flush>
					<Pressable
						accessibilityRole="button"
						onPress={() => router.push("/categories")}
						className="flex-row items-center gap-3 px-4 py-4 active:opacity-70"
					>
						<View className="w-9 h-9 rounded-full items-center justify-center bg-primary-highlight">
							<Ionicons name="pricetags-outline" size={18} color={tc.primary} />
						</View>
						<View className="flex-1">
							<Text
								className="font-medium text-foreground"
								style={{ fontSize: tf.base }}
							>
								Categories
							</Text>
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.sm }}
							>
								{categories.length} categories ·{" "}
								{categories.reduce((n, c) => n + c.subcategories.length, 0)}{" "}
								subcategories
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={18} color={tc.mutedForeground} />
					</Pressable>
				</Card>
			</ScrollView>
		</View>
	);
}
