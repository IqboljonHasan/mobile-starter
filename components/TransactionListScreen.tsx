import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Pressable,
	ScrollView,
	SectionList,
	Text,
	View,
} from "react-native";
import MonthSwitcher from "@/components/MonthSwitcher";
import TabHeader from "@/components/TabHeader";
import TransactionRow from "@/components/TransactionRow";
import { Button, Card, EmptyState } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, formatDayLabel } from "@/lib/date";
import {
	groupByDay,
	inMonth,
	inUnit,
	ofType,
	sumByMethod,
	sumByUnit,
} from "@/lib/ledger";
import { formatAmount, PAY_METHODS } from "@/lib/money";
import type { TxType } from "@/lib/types";
import "../global.css";

/**
 * The body of both the Income and the Expense tab — the two differ only in
 * which side of the ledger they show, so they share one screen rather than two
 * near-identical copies.
 */
export default function TransactionListScreen({ type }: { type: TxType }) {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow(type);
	const { ready, transactions, categories } = useLedger();

	const [month, setMonth] = useState(currentMonthKey);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

	const income = type === "income";
	const title = income ? "Kirim" : "Chiqim";

	const monthly = useMemo(
		() => ofType(inMonth(transactions, month), type),
		[transactions, month, type],
	);

	// Only categories that actually appear this month are offered as filters —
	// a chip that can only ever return an empty list is just clutter.
	const usedCategories = useMemo(() => {
		const ids = new Set(monthly.map((t) => t.categoryId));
		return categories.filter((c) => ids.has(c.id));
	}, [monthly, categories]);

	const filtered = useMemo(
		() =>
			categoryFilter
				? monthly.filter((t) => t.categoryId === categoryFilter)
				: monthly,
		[monthly, categoryFilter],
	);

	const sections = useMemo(() => groupByDay(filtered), [filtered]);
	const totals = useMemo(() => sumByUnit(filtered), [filtered]);

	const subtitle = totals.length
		? totals.map((t) => formatAmount(t.amount, t.unit)).join("  ·  ")
		: "Yozuv yo'q";

	const addHref = `/transaction?type=${type}` as const;

	if (!ready) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title={title} />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1 bg-background">
			<TabHeader title={title} subtitle={subtitle} />

			<SectionList
				{...shadow}
				sections={sections}
				keyExtractor={(item) => item.id}
				stickySectionHeadersEnabled={false}
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
				ListHeaderComponent={
					<View className="px-4 gap-3" style={{ marginBottom: 12 }}>
						<Card>
							<MonthSwitcher value={month} onChange={setMonth} />
							{/* One block per unit: som and dollars can't be added, so a
							    month holding both reports each on its own terms rather
							    than inventing a single figure. */}
							{totals.map((total) => {
								const split = sumByMethod(inUnit(filtered, total.unit));
								return (
									<View key={total.unit} className="items-center pt-4">
										<Text
											className="text-muted-foreground"
											style={{ fontSize: tf.sm }}
										>
											{categoryFilter ? "Tanlangan kategoriya" : "Bu oy jami"}
										</Text>
										<Text
											className={`font-bold mt-1 ${
												income ? "text-success" : "text-danger"
											}`}
											style={{ fontSize: tf.xxxl }}
											numberOfLines={1}
											adjustsFontSizeToFit
										>
											{formatAmount(total.amount, total.unit)}
										</Text>
										<View className="flex-row gap-3 mt-3">
											{PAY_METHODS.map((payMethod) => (
												<View
													key={payMethod.key}
													className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5"
												>
													<Ionicons
														name={payMethod.icon}
														size={14}
														color={tc.mutedForeground}
													/>
													<Text
														className="font-semibold text-foreground"
														style={{ fontSize: tf.sm }}
														numberOfLines={1}
													>
														{formatAmount(split[payMethod.key], total.unit)}
													</Text>
												</View>
											))}
										</View>
									</View>
								);
							})}
						</Card>
						{usedCategories.length > 1 && (
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								contentContainerStyle={{ gap: 8, paddingRight: 8 }}
							>
								<FilterChip
									label="Hammasi"
									active={categoryFilter === null}
									onPress={() => setCategoryFilter(null)}
								/>
								{usedCategories.map((category) => (
									<FilterChip
										key={category.id}
										label={category.name}
										active={categoryFilter === category.id}
										onPress={() =>
											setCategoryFilter((current) =>
												current === category.id ? null : category.id,
											)
										}
									/>
								))}
							</ScrollView>
						)}
					</View>
				}
				renderSectionHeader={({ section }) => (
					<View className="flex-row items-end justify-between px-5 pt-4 pb-1.5">
						<Text
							className="font-semibold text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							{formatDayLabel(section.title)}
						</Text>
						<Text
							className={`font-semibold ${income ? "text-success" : "text-danger"}`}
							style={{ fontSize: tf.sm }}
						>
							{section.totals
								.map((t) => formatAmount(t.amount, t.unit))
								.join("  ·  ")}
						</Text>
					</View>
				)}
				renderItem={({ item, index, section }) => (
					// Rows of a day are one grouped card: only the ends get rounded,
					// so a day reads as a single block rather than a stack of chips.
					<View
						className={`mx-4 bg-card ${index === 0 ? "rounded-t-2xl" : ""} ${
							index === section.data.length - 1 ? "rounded-b-2xl" : ""
						}`}
					>
						<TransactionRow
							transaction={item}
							categories={categories}
							divider={index > 0}
							onPress={() => router.push(`/transaction?id=${item.id}`)}
						/>
					</View>
				)}
				ListEmptyComponent={
					<EmptyState
						icon={income ? "trending-up-outline" : "trending-down-outline"}
						title={`Bu oyda ${income ? "kirim" : "chiqim"} yo'q`}
						message={
							categoryFilter
								? "Bu kategoriyada yozuv yo'q. Filtrni tozalab ko'ring."
								: income
									? "Tushgan pulni qo'shing va u shu yerda ko'rinadi."
									: "Sarflangan pulni qo'shing va u shu yerda ko'rinadi."
						}
						actionLabel={income ? "Kirim qo'shish" : "Chiqim qo'shish"}
						onAction={() => router.push(addHref)}
					/>
				}
			/>

			<View className="absolute right-4 bottom-4">
				<Button
					label="Qo'shish"
					shape="pill"
					color={income ? "success" : "danger"}
					startIcon={<Ionicons name="add" size={20} color="#fff" />}
					onPress={() => router.push(addHref)}
					accessibilityLabel={income ? "Kirim qo'shish" : "Chiqim qo'shish"}
				/>
			</View>
		</View>
	);
}

function FilterChip({
	label,
	active,
	onPress,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
}) {
	const { tf } = useFont();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityState={{ selected: active }}
			onPress={onPress}
			className={`px-3.5 py-2 rounded-full active:opacity-70 ${
				active ? "bg-primary-highlight" : "bg-card"
			}`}
		>
			<Text
				className={`font-medium ${active ? "text-primary" : "text-muted-foreground"}`}
				style={{ fontSize: tf.sm }}
			>
				{label}
			</Text>
		</Pressable>
	);
}
