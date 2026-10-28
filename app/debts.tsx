import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, SectionList, View } from "react-native";
import BottomBar, { BOTTOM_BAR_FADE, BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import DebtRow from "@/components/DebtRow";
import FilterTile from "@/components/FilterTile";
import RemindersSheet from "@/components/RemindersSheet";
import SearchBar from "@/components/SearchBar";
import { Button, Chip, EmptyState, HeaderMenu, PillTabs } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import ScrollShadow from "@/components/ScrollShadow";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { useStickyHeaderShadow } from "@/hooks/useStickyHeaderShadow";
import { todayISO } from "@/lib/date";
import {
	contactById,
	type DebtStatus,
	debtStatus,
	outstandingByUnit,
	remainingAmount,
	sortDebts,
} from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import { foldForSearch, matchesSearch } from "@/lib/search";
import type { DebtDirection } from "@/lib/types";
import "../global.css";

/** Which slice of the list is showing, by state. There is no "all": the
 *  screen is for what is still owed, and settled debts are history kept one
 *  tap away rather than mixed in. */
type Filter = "open" | "overdue" | "settled";

const FILTERS: { key: Filter; label: string }[] = [
	{ key: "open", label: "Faol" },
	{ key: "overdue", label: "Muddati o'tgan" },
	{ key: "settled", label: "Yopilgan" },
];

/** The list's groups, in the order they need attention. */
const GROUPS: { key: DebtStatus; label: string }[] = [
	{ key: "overdue", label: "Muddati o'tgan" },
	{ key: "open", label: "Faol" },
	{ key: "settled", label: "Yopilgan" },
];

/** A group's header — the same for every group, so the shade can sit right
 *  under whichever one is stuck at the top. */
const SECTION_HEADER_HEIGHT = 40;

/**
 * Who owes what, and to whom.
 *
 * Every movement shown here is also a real entry in the ledger — borrowing
 * writes an income, lending an expense, and each repayment the opposite — so
 * the money genuinely enters and leaves wallets. What this screen adds on top
 * is the running balance per loan, which a flat list of transactions can't
 * carry.
 *
 * Debts are listed whole rather than by month: what is owed is an all-time
 * balance, like a wallet's, and a loan given in August is still owed in
 * October. Overdue ones come first, then the open ones, then the history.
 */
export default function DebtsScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const { ready, debts, contacts, defaultUnit } = useLedger();

	const [direction, setDirection] = useState<DebtDirection | null>(null);
	const [filter, setFilter] = useState<Filter>("open");
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");
	const [remindersOpen, setRemindersOpen] = useState(false);
	const { edge, listProps } = useStickyHeaderShadow(SECTION_HEADER_HEIGHT);
	const folded = foldForSearch(query);
	const today = todayISO();

	// One unit at a time, as everywhere else — som owed and dollars owed are
	// two separate facts, not one sum.
	const totals = useMemo(() => outstandingByUnit(debts), [debts]);
	const units = totals.map((t) => t.unit);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: (units[0] ?? defaultUnit);
	const total = totals.find((t) => t.unit === unit) ?? { owedToMe: 0, owedByMe: 0 };

	const sections = useMemo(() => {
		const matched = debts.filter((debt) => {
			if (direction && debt.direction !== direction) return false;
			// The person is what a debt is looked up by; its note too.
			const contact = contactById(contacts, debt.contactId);
			if (!matchesSearch(folded, [contact?.name, contact?.phone, debt.description])) {
				return false;
			}
			const status = debtStatus(debt, today);
			if (filter === "open") return status !== "settled";
			return status === filter;
		});
		return GROUPS.map((group) => {
			const data = sortDebts(
				matched.filter((d) => debtStatus(d, today) === group.key),
				today,
			);
			// What the group nets to per unit: owed to the user counts up, owed
			// by them down. A settled group is history, so it's only counted.
			const byUnit = new Map<string, number>();
			for (const d of data) {
				const signed = (d.direction === "lent" ? 1 : -1) * remainingAmount(d);
				byUnit.set(d.unit, (byUnit.get(d.unit) ?? 0) + signed);
			}
			return {
				key: group.key,
				title: group.label,
				totals: [...byUnit.entries()].map(([u, amount]) => ({ unit: u, amount })),
				data,
			};
		}).filter((section) => section.data.length > 0);
	}, [debts, direction, filter, today, contacts, folded]);

	const openDebt = (next: DebtDirection) => router.push(`/debt?direction=${next}`);

	// The list's last row has to clear the buttons and their fade. Measured
	// rather than assumed: both sit in this screen's root, so the list's bottom
	// edge less the top of the fade is exactly what the end of the list needs.
	const [listBottom, setListBottom] = useState<number | null>(null);
	const [fadeTop, setFadeTop] = useState<number | null>(null);
	const listEndSpace =
		listBottom !== null && fadeTop !== null
			? Math.max(listBottom - fadeTop, 0) + 12
			: BOTTOM_BAR_SPACE + 16;

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
						<HeaderMenu
							items={[
								{
									key: "search",
									label: "Qidirish",
									icon: "search-outline",
									onPress: () => setSearching(true),
								},
								{
									key: "reminders",
									label: "Eslatmalar",
									icon: "notifications-outline",
									onPress: () => setRemindersOpen(true),
								},
								{
									key: "contacts",
									label: "Kontaktlar",
									icon: "people-outline",
									onPress: () => router.push("/contacts"),
								},
							]}
						/>
					),
				}}
			/>

			<View style={{ paddingHorizontal: 18, gap: 14, paddingTop: 6 }}>
				{searching && (
					<SearchBar
						value={query}
						onChangeText={setQuery}
						placeholder="Ism yoki izoh bo'yicha qidirish"
						onClose={() => {
							setQuery("");
							setSearching(false);
						}}
					/>
				)}
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
						label="Berilgan"
						tone="success"
						arrow="up-right"
						text={formatAmount(total.owedToMe, unit, { showUnit: unit !== defaultUnit })}
						active={direction === "lent"}
						accessibilityLabel="Faqat berilgan qarzlar"
						onPress={() => setDirection((d) => (d === "lent" ? null : "lent"))}
					/>
					<FilterTile
						label="Olingan"
						tone="danger"
						arrow="down-left"
						text={formatAmount(total.owedByMe, unit, { showUnit: unit !== defaultUnit })}
						active={direction === "borrowed"}
						accessibilityLabel="Faqat olingan qarzlar"
						onPress={() => setDirection((d) => (d === "borrowed" ? null : "borrowed"))}
					/>
				</View>
			</View>

			<ScrollView
				horizontal
				accessibilityLabel="Holat bo'yicha filtr"
				showsHorizontalScrollIndicator={false}
				style={{ flexGrow: 0, marginTop: 14 }}
				contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingBottom: 8 }}
			>
				{FILTERS.map((item) => (
					<Chip
						key={item.key}
						label={item.label}
						dot={item.key === "overdue" ? tc.danger : undefined}
						active={filter === item.key}
						onPress={() => setFilter(item.key)}
					/>
				))}
			</ScrollView>

			<View
				className="flex-1"
				onLayout={(e) => setListBottom(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}
			>
				<SectionList
					{...listProps}
					sections={sections}
					keyExtractor={(item) => item.id}
					stickySectionHeadersEnabled
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: listEndSpace }}
					renderSectionHeader={({ section }) => {
						const color = section.key === "overdue" ? tc.danger : tc.mutedForeground;
						return (
							<View
								className="flex-row items-center justify-between bg-background"
								style={{ height: SECTION_HEADER_HEIGHT }}
							>
								<Text
									accessibilityRole="header"
									className="font-bold"
									style={{ fontSize: tf.sm - 0.5, color }}
								>
									{section.title}
								</Text>
								<Text className="font-bold" style={{ fontSize: tf.sm - 0.5, color }}>
									{section.key === "settled"
										? `${section.data.length} ta`
										: section.totals
												.map((t) =>
													formatAmount(t.amount, t.unit, {
														showUnit: t.unit !== defaultUnit,
														signed: true,
													}),
												)
												.join("  ·  ")}
								</Text>
							</View>
						);
					}}
					// The gap between groups goes after each group rather than as a
					// margin on the next header: a stuck header would carry the margin
					// with it, a see-through strip rows show through.
					renderSectionFooter={() => <View style={{ height: 8 }} />}
					renderItem={({ item, index }) => (
						<DebtRow
							debt={item}
							contact={contactById(contacts, item.contactId)}
							today={today}
							divider={index > 0}
							onPress={() => router.push(`/debt?id=${item.id}`)}
						/>
					)}
					ListEmptyComponent={
						<EmptyState
							icon="people-outline"
							title="Qarz topilmadi"
							message={
								debts.length === 0
									? "Qarz berganingizni yoki olganingizni shu yerda yuriting — har biri hisobingizga ham yoziladi."
									: folded
										? `"${query.trim()}" bo'yicha qarz topilmadi`
										: filter === "open"
											? "Faol qarz yo'q — yopilganlari «Yopilgan»da"
											: "Bu filtr bo'yicha qarz yo'q"
							}
						/>
					}
				/>
				{/* Under the stuck group header, or the filters while the next
				    group pushes that header out. */}
				<ScrollShadow visible={edge === "header"} top={SECTION_HEADER_HEIGHT} />
				<ScrollShadow visible={edge === "top"} />
			</View>

			{/* Both directions are one tap away: which way a debt runs is the first
			    thing the user knows about it, so it shouldn't be a field they have
			    to change after opening the wrong form. */}
			<BottomBar
				onLayout={(e) =>
					setFadeTop(e.nativeEvent.layout.y + e.nativeEvent.layout.height - BOTTOM_BAR_FADE)
				}
			>
				<View className="flex-1">
					<Button
						label="Qarz berdim"
						variant="soft"
						color="success"
						size="lg"
						fullWidth
						accessibilityLabel="Bergan qarzimni qo'shish"
						startIcon={<Ionicons name="add" size={20} color={tc.success} />}
						onPress={() => openDebt("lent")}
					/>
				</View>
				<View className="flex-1">
					<Button
						label="Qarz oldim"
						variant="soft"
						color="danger"
						size="lg"
						fullWidth
						accessibilityLabel="Olgan qarzimni qo'shish"
						startIcon={<Ionicons name="add" size={20} color={tc.danger} />}
						onPress={() => openDebt("borrowed")}
					/>
				</View>
			</BottomBar>

			<RemindersSheet visible={remindersOpen} onClose={() => setRemindersOpen(false)} />
		</View>
	);
}
