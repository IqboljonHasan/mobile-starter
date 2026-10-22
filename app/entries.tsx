import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, SectionList, View } from "react-native";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import FilterTile from "@/components/FilterTile";
import MonthSwitcher from "@/components/MonthSwitcher";
import TransactionRow from "@/components/TransactionRow";
import {
	ActionSheet,
	Button,
	Chip,
	EmptyState,
	IconButton,
	PillTabs,
	Select,
} from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { currentMonthKey, formatSectionDay, monthName } from "@/lib/date";
import { excludeDebts, inMonth, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import type { Transaction, TxType } from "@/lib/types";
import "../global.css";

type TypeFilter = "all" | TxType;

/**
 * What one wallet got out of an entry: an income's share of the split (or all
 * of it, when it landed whole in that wallet), or an expense's full amount
 * when that wallet paid it. Zero means the entry never touched the wallet.
 */
function shareOf(t: Transaction, walletId: string | null): number {
	if (!walletId) return t.amount;
	if (t.type === "expense") return t.walletId === walletId ? t.amount : 0;
	const allocation = t.allocations.find((a) => a.walletId === walletId);
	if (allocation) return allocation.amount;
	return t.allocations.length === 0 && t.walletId === walletId ? t.amount : 0;
}

/**
 * Kirim va chiqimlar — both sides of the ledger in one list, a month at a
 * time, grouped by day. Two tiles at the top total the month and double as a
 * filter for one side; the chips under them narrow it to a wallet, where an
 * income counts only for the share that wallet actually received.
 *
 * Opened from Home with the filter already set — a wallet tile, the month's
 * income or spending — through `?wallet=`, `?type=` and `?month=`.
 */
export default function EntriesScreen() {
	const router = useRouter();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ type?: string; wallet?: string; month?: string }>();
	const { ready, transactions, categories, wallets, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats } = usePreferences();

	const [month, setMonth] = useState(() =>
		params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : currentMonthKey(),
	);
	const [type, setType] = useState<TypeFilter>(
		params.type === "income" || params.type === "expense" ? params.type : "all",
	);
	const [walletFilter, setWalletFilter] = useState<string | null>(params.wallet ?? null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [menuOpen, setMenuOpen] = useState(false);

	const monthly = useMemo(() => inMonth(transactions, month), [transactions, month]);

	// Everything that narrows the list except the side, which the tiles show
	// both of: the wallet (by share) and the category.
	const narrowed = useMemo(
		() =>
			monthly.filter(
				(t) =>
					(!categoryFilter || t.categoryId === categoryFilter) &&
					shareOf(t, walletFilter) > 0,
			),
		[monthly, categoryFilter, walletFilter],
	);

	const visible = useMemo(
		() => (type === "all" ? narrowed : narrowed.filter((t) => t.type === type)),
		[narrowed, type],
	);

	// Amounts in different units can't be added up, so the tiles total one
	// unit at a time — the default when the month holds it — and offer a
	// chooser only when there's an actual choice. The list itself shows every
	// unit; a row in another currency carries its symbol.
	const units = useMemo(() => unitsUsed(narrowed), [narrowed]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: (units[0] ?? defaultUnit);

	// The tiles are a stat, and debt categories are left out of them by default
	// — but once the user has filtered down to one category (debt or not), that
	// filter says exactly what they want totalled, so it's shown as-is.
	const totals = useMemo(() => {
		const counted = categoryFilter || includeDebtsInStats ? narrowed : excludeDebts(narrowed);
		let income = 0;
		let expense = 0;
		for (const t of counted) {
			if (t.unit !== unit) continue;
			if (t.type === "income") income += shareOf(t, walletFilter);
			else expense += shareOf(t, walletFilter);
		}
		return { income, expense };
	}, [narrowed, categoryFilter, includeDebtsInStats, unit, walletFilter]);

	const sections = useMemo(() => {
		const days = new Map<string, Transaction[]>();
		for (const t of visible) {
			const list = days.get(t.date);
			if (list) list.push(t);
			else days.set(t.date, [t]);
		}
		return [...days.entries()]
			.sort(([a], [b]) => (a < b ? 1 : -1))
			.map(([date, items]) => {
				// The day's net per unit — money in minus money out, as the wallet
				// filter counts it.
				const byUnit = new Map<string, number>();
				let hasIncome = false;
				for (const t of items) {
					if (t.type === "income") hasIncome = true;
					const signed = (t.type === "income" ? 1 : -1) * shareOf(t, walletFilter);
					byUnit.set(t.unit, (byUnit.get(t.unit) ?? 0) + signed);
				}
				return {
					title: date,
					hasIncome,
					totals: [...byUnit.entries()].map(([u, amount]) => ({ unit: u, amount })),
					data: [...items].sort((a, b) => b.createdAt - a.createdAt),
				};
			});
	}, [visible, walletFilter]);

	// Only categories that actually appear this month are offered — a filter
	// that can only ever return an empty list is just clutter.
	const categorySections = useMemo(() => {
		const used = new Set(
			monthly.filter((t) => type === "all" || t.type === type).map((t) => t.categoryId),
		);
		return (["income", "expense"] as TxType[])
			.filter((side) => type === "all" || side === type)
			.map((side) => ({
				title: side === "income" ? "Kirim" : "Chiqim",
				options: categories
					.filter((c) => c.type === side && used.has(c.id))
					.map((c) => ({ key: c.id, label: c.name })),
			}))
			.filter((section) => section.options.length > 0);
	}, [monthly, categories, type]);
	const pickedCategory = categories.find((c) => c.id === categoryFilter) ?? null;

	const money = (amount: number, u: string, signed = false) =>
		formatAmount(amount, u, { showUnit: u !== defaultUnit, signed });

	if (!ready) {
		return (
			<View className="flex-1 bg-background items-center justify-center">
				<ActivityIndicator color={tc.foreground} />
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					headerRight: () => (
						<IconButton
							variant="filled"
							icon="ellipsis-vertical"
							accessibilityLabel="Boshqa amallar"
							onPress={() => setMenuOpen(true)}
						/>
					),
				}}
			/>

			{/* What the list is scoped to — stays put while the list scrolls ---- */}
			<View style={{ paddingHorizontal: 18, gap: 14, paddingTop: 6 }}>
				<MonthSwitcher value={month} onChange={setMonth} />
				{units.length > 1 && (
					<PillTabs
						compact
						fill
						items={units.map((code) => ({ key: code, label: code }))}
						value={unit}
						onChange={setPickedUnit}
					/>
				)}

				<View className="flex-row" style={{ gap: 4 }}>
					<FilterTile
						label="Kirim"
						tone="success"
						arrow="down"
						text={hideIncome ? maskAmount(unit) : money(totals.income, unit)}
						active={type === "income"}
						accessibilityLabel="Faqat kirimlarni ko'rsatish"
						onPress={() => setType((t) => (t === "income" ? "all" : "income"))}
					/>
					<FilterTile
						label="Chiqim"
						tone="danger"
						arrow="up"
						text={money(totals.expense, unit)}
						active={type === "expense"}
						accessibilityLabel="Faqat chiqimlarni ko'rsatish"
						onPress={() => setType((t) => (t === "expense" ? "all" : "expense"))}
					/>
				</View>
			</View>

			<ScrollView
				horizontal
				accessibilityLabel="Hamyon bo'yicha filtr"
				showsHorizontalScrollIndicator={false}
				style={{ flexGrow: 0, marginTop: 14 }}
				contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingBottom: 8 }}
			>
				<Chip
					label="Hammasi"
					active={walletFilter === null && categoryFilter === null}
					onPress={() => {
						setWalletFilter(null);
						setCategoryFilter(null);
					}}
				/>
				{wallets.map((w) => (
					<Chip
						key={w.id}
						label={w.name}
						dot={categoryColorValue(w.color, isDark)}
						active={walletFilter === w.id}
						onPress={() => setWalletFilter((current) => (current === w.id ? null : w.id))}
					/>
				))}
				{categorySections.length > 0 && (
					<Select
						label="Kategoriya bo'yicha"
						value={categoryFilter}
						onChange={setCategoryFilter}
						sections={categorySections}
						clearable
						trigger={({ open }) => (
							<Chip
								label={pickedCategory?.name ?? "Kategoriya"}
								icon={pickedCategory ? "close" : "chevron-down"}
								active={!!pickedCategory}
								accessibilityLabel={
									pickedCategory
										? `Kategoriya: ${pickedCategory.name}. Filtrni olib tashlash`
										: "Kategoriya bo'yicha filtr"
								}
								onPress={pickedCategory ? () => setCategoryFilter(null) : open}
							/>
						)}
					/>
				)}
			</ScrollView>

			<SectionList
				sections={sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: BOTTOM_BAR_SPACE + 16 }}
				renderSectionHeader={({ section }) => {
					const masked = hideIncome && section.hasIncome;
					return (
						<View
							className="flex-row items-center justify-between bg-background"
							style={{ height: 40, marginTop: section.title === sections[0]?.title ? 0 : 8 }}
						>
							<Text
								accessibilityRole="header"
								className="font-bold text-muted-foreground"
								style={{ fontSize: tf.sm - 0.5 }}
							>
								{formatSectionDay(section.title)}
							</Text>
							<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.sm - 0.5 }}>
								{section.totals
									.map((t) => (masked ? maskAmount(t.unit) : money(t.amount, t.unit, true)))
									.join("  ·  ")}
							</Text>
						</View>
					);
				}}
				renderItem={({ item, index }) => (
					<TransactionRow
						transaction={item}
						categories={categories}
						divider={index > 0}
						amountOverride={walletFilter ? shareOf(item, walletFilter) : undefined}
						onPress={() => router.push(`/transaction?id=${item.id}`)}
					/>
				)}
				ListEmptyComponent={
					<EmptyState
						icon="receipt-outline"
						title="Yozuv topilmadi"
						message={
							monthly.length === 0
								? `${monthName(month)}da hali yozuv yo'q. Kirim yoki chiqim qo'shing — u shu yerda ko'rinadi.`
								: `Bu filtr bo'yicha ${monthName(month).toLowerCase()}da yozuv yo'q`
						}
					/>
				}
			/>

			<BottomBar>
				<View className="flex-1">
					<Button
						label="Kirim"
						variant="soft"
						color="success"
						size="lg"
						fullWidth
						accessibilityLabel="Kirim qo'shish"
						startIcon={<Ionicons name="add" size={20} color={tc.success} />}
						onPress={() => router.push("/transaction?type=income")}
					/>
				</View>
				<View className="flex-1">
					<Button
						label="Chiqim"
						variant="soft"
						color="danger"
						size="lg"
						fullWidth
						accessibilityLabel="Chiqim qo'shish"
						startIcon={<Ionicons name="add" size={20} color={tc.danger} />}
						onPress={() => router.push("/transaction?type=expense")}
					/>
				</View>
			</BottomBar>

			<ActionSheet
				visible={menuOpen}
				onClose={() => setMenuOpen(false)}
				items={[
					{
						key: "stats",
						label: "Hisobot",
						hint: "Kategoriyalar bo'yicha tahlil",
						icon: "bar-chart-outline",
						onPress: () => router.push(`/stats?month=${month}`),
					},
					{
						key: "categories",
						label: "Kategoriyalar",
						icon: "pricetags-outline",
						onPress: () => router.push("/categories"),
					},
					{
						key: "wallets",
						label: "Hamyonlar",
						icon: "wallet-outline",
						onPress: () => router.push("/wallets"),
					},
				]}
			/>
		</View>
	);
}
