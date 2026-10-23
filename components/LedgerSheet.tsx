import BottomSheet, {
	type BottomSheetBackgroundProps,
	BottomSheetFooter,
	type BottomSheetFooterProps,
	BottomSheetSectionList,
	useBottomSheet,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import MonthSwitcher from "@/components/MonthSwitcher";
import SearchBar from "@/components/SearchBar";
import TransactionRow from "@/components/TransactionRow";
import { Button, Chip, EmptyState, HeaderMenu, IconButton, PillTabs, Select } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { formatSectionDay, monthName } from "@/lib/date";
import { excludeDebts, inMonth, resolveCategory, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import { foldForSearch, matchesSearch } from "@/lib/search";
import { homePalette, RADIUS } from "@/lib/theme";
import type { Transaction, TxType } from "@/lib/types";

type TypeFilter = "all" | TxType;

export type LedgerSheetHandle = {
	/** Pulls the ledger up, narrowed to one side or one wallet when asked. */
	open: (filter?: { type?: TxType; walletId?: string }) => void;
};

/** The grabber strip above the content. */
const HANDLE_HEIGHT = 19;
/** The title row that slides in over the top as the sheet opens. */
const TITLE_HEIGHT = 56;
/** The Kirim / Chiqim buttons pinned to the sheet's bottom edge. */
const FOOTER_HEIGHT = 82;

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
 * Home's month panel and the month's whole ledger, as one sheet.
 *
 * At rest it is the panel: the month, what came in and went out, and the two
 * add buttons. Pulled up, it rises to the top as if Home were scrolling — the
 * screen above moves with it (see `animatedPosition`) — and turns into
 * Kirim va chiqimlar: the month's entries grouped by day, filterable by side,
 * wallet, category and search, with the title row and the filters staying put
 * while the list scrolls under them. Dragging it back down, from its top or
 * from the top of the list, or the back button, scrolls it back.
 *
 * It only moves when pulled: a tap on the panel does nothing but what the
 * tapped control does.
 */
export default function LedgerSheet({
	ref,
	month,
	onMonthChange,
	animatedPosition,
	onCollapsedHeight,
}: {
	ref?: Ref<LedgerSheetHandle>;
	month: string;
	onMonthChange: (month: string) => void;
	/** The sheet's top edge, for the screen behind to scroll along with it. */
	animatedPosition: SharedValue<number>;
	/** How tall the sheet stands at rest, so the screen behind can end above it. */
	onCollapsedHeight?: (height: number) => void;
}) {
	const router = useRouter();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const { isDark } = useTheme();
	const { tf } = useFont();
	const { transactions, categories, wallets, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats } = usePreferences();

	const sheet = useRef<BottomSheet>(null);
	const animatedIndex = useSharedValue(0);
	const [expanded, setExpanded] = useState(false);
	const [blockHeight, setBlockHeight] = useState(150);

	const [type, setType] = useState<TypeFilter>("all");
	const [walletFilter, setWalletFilter] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");

	const collapsedHeight = HANDLE_HEIGHT + blockHeight + FOOTER_HEIGHT;
	const snapPoints = useMemo(() => [collapsedHeight, "100%"], [collapsedHeight]);
	useEffect(() => onCollapsedHeight?.(collapsedHeight), [collapsedHeight, onCollapsedHeight]);

	useImperativeHandle(ref, () => ({
		open: (filter) => {
			setType(filter?.type ?? "all");
			setWalletFilter(filter?.walletId ?? null);
			sheet.current?.snapToIndex(1);
		},
	}));

	const close = useCallback(() => sheet.current?.snapToIndex(0), []);

	// At rest a side's total opens the ledger on that side; with the ledger up
	// it narrows the list to that side and back.
	const pickSide = (side: TxType) => {
		if (expanded) {
			setType((t) => (t === side ? "all" : side));
			return;
		}
		setType(side);
		sheet.current?.snapToIndex(1);
	};

	// Back scrolls the ledger down before it leaves the app — but only while
	// Home is the screen showing; over a form, back belongs to the form.
	useEffect(() => {
		if (!expanded) return;
		const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
			if (!navigation.isFocused()) return false;
			close();
			return true;
		});
		return () => subscription.remove();
	}, [expanded, navigation, close]);

	// Back at rest the sheet is the panel again, which reports the whole month.
	const settle = (index: number) => {
		if (index > 0) return;
		setType("all");
		setWalletFilter(null);
		setCategoryFilter(null);
		setSearching(false);
		setQuery("");
	};

	/* The month's entries -------------------------------------------------- */

	const monthly = useMemo(() => inMonth(transactions, month), [transactions, month]);

	// Everything that narrows the list except the side, which the totals show
	// both of: the wallet (by share), the category, and the search — which
	// reads what a row shows: its note, its category and subcategory, and the
	// amount's digits.
	const folded = foldForSearch(query);
	const narrowed = useMemo(
		() =>
			monthly.filter((t) => {
				if (categoryFilter && t.categoryId !== categoryFilter) return false;
				if (shareOf(t, walletFilter) <= 0) return false;
				if (!folded) return true;
				const { category, subcategory } = resolveCategory(t, categories);
				return matchesSearch(folded, [t.description, category?.name, subcategory?.name, String(t.amount)]);
			}),
		[monthly, categoryFilter, walletFilter, folded, categories],
	);
	const visible = useMemo(
		() => (type === "all" ? narrowed : narrowed.filter((t) => t.type === type)),
		[narrowed, type],
	);

	// Amounts in different units can't be added up, so the totals report one
	// unit at a time — the default when the month holds it — with a chooser
	// only when there's an actual choice. The list shows every unit.
	const units = useMemo(() => unitsUsed(narrowed), [narrowed]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: (units[0] ?? defaultUnit);

	// A stat, so debt categories stay out unless the user asked for them — or
	// has filtered down to one category, which says exactly what to total.
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

	// Only categories that actually appear this month are offered.
	const categorySections = useMemo(() => {
		const used = new Set(monthly.filter((t) => type === "all" || t.type === type).map((t) => t.categoryId));
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

	/* Motion ---------------------------------------------------------------- */

	// The title row fades in over the top as the sheet nears the top, and the
	// rest of the content steps down to make room for it.
	const titleStyle = useAnimatedStyle(() => ({
		opacity: interpolate(animatedIndex.get(), [0.55, 1], [0, 1], Extrapolation.CLAMP),
	}));
	const bodyStyle = useAnimatedStyle(() => ({
		transform: [
			{ translateY: interpolate(animatedIndex.get(), [0, 1], [0, TITLE_HEIGHT], Extrapolation.CLAMP) },
		],
	}));
	// What only the open ledger has — the filters and the list — comes in as
	// soon as the sheet starts to rise.
	const ledgerStyle = useAnimatedStyle(() => ({
		opacity: interpolate(animatedIndex.get(), [0, 0.3], [0, 1], Extrapolation.CLAMP),
	}));

	const renderFooter = useCallback(
		(props: BottomSheetFooterProps) => (
			<BottomSheetFooter {...props} bottomInset={0}>
				<SheetFooter
					onIncome={() => router.push("/transaction?type=income")}
					onExpense={() => router.push("/transaction?type=expense")}
				/>
			</BottomSheetFooter>
		),
		[router],
	);

	return (
		<BottomSheet
			ref={sheet}
			index={0}
			snapPoints={snapPoints}
			enableDynamicSizing={false}
			topInset={insets.top + 8}
			animatedIndex={animatedIndex}
			animatedPosition={animatedPosition}
			animateOnMount={false}
			enableOverDrag={false}
			onAnimate={(_from, to) => setExpanded(to > 0)}
			onChange={settle}
			handleComponent={SheetHandle}
			backgroundComponent={SheetBackground}
			footerComponent={renderFooter}
		>
			{/* Title row: only there once the ledger is up ------------------- */}
			<Animated.View
				pointerEvents={expanded ? "box-none" : "none"}
				style={[
					{ position: "absolute", top: 0, left: 0, right: 0, height: TITLE_HEIGHT, zIndex: 2 },
					titleStyle,
				]}
			>
				<View className="flex-row items-center" style={{ height: 44, gap: 6, paddingHorizontal: 12, marginTop: 4 }}>
					{searching ? (
						<View className="flex-1" style={{ paddingHorizontal: 6 }}>
							<SearchBar
								value={query}
								onChangeText={setQuery}
								placeholder={`${monthName(month)} yozuvlaridan qidirish`}
								onClose={() => {
									setQuery("");
									setSearching(false);
								}}
							/>
						</View>
					) : (
						<>
							<IconButton variant="ghost" icon="arrow-back" accessibilityLabel="Orqaga" onPress={close} />
							<Text
								accessibilityRole="header"
								className="flex-1 font-extrabold text-foreground"
								style={{ fontSize: tf.xxl, letterSpacing: -0.2 }}
								numberOfLines={1}
							>
								Kirim va chiqimlar
							</Text>
							<HeaderMenu
								items={[
									{
										key: "search",
										label: "Qidirish",
										icon: "search-outline",
										onPress: () => setSearching(true),
									},
									{
										key: "filters",
										label: "Filtrlar",
										icon: "options-outline",
										onPress: () => setCategoryPickerOpen(true),
									},
									{
										key: "stats",
										label: "Hisobot",
										icon: "bar-chart-outline",
										onPress: () => router.push(`/stats?month=${month}`),
									},
								]}
							/>
						</>
					)}
				</View>
			</Animated.View>

			<Animated.View style={[{ flex: 1 }, bodyStyle]}>
				{/* The panel itself: month and its totals ----------------------- */}
				<View
					onLayout={(e) => setBlockHeight(Math.round(e.nativeEvent.layout.height))}
					style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, gap: 14 }}
				>
					<MonthSwitcher value={month} onChange={onMonthChange} surface="glass" />
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
						<SideTotal
							type="income"
							text={hideIncome ? maskAmount(unit) : money(totals.income, unit)}
							active={type === "income"}
							onPress={() => pickSide("income")}
						/>
						<SideTotal
							type="expense"
							text={money(totals.expense, unit)}
							active={type === "expense"}
							onPress={() => pickSide("expense")}
						/>
					</View>
				</View>

				{/* The ledger: filters, then the days --------------------------- */}
				<Animated.View style={[{ flex: 1 }, ledgerStyle]} pointerEvents={expanded ? "auto" : "none"}>
					<ScrollView
						horizontal
						accessibilityLabel="Hamyon bo'yicha filtr"
						showsHorizontalScrollIndicator={false}
						style={{ flexGrow: 0 }}
						contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingBottom: 8 }}
					>
						{pickedCategory && (
							<Chip
								label={pickedCategory.name}
								icon="close"
								active
								accessibilityLabel={`Kategoriya: ${pickedCategory.name}. Filtrni olib tashlash`}
								onPress={() => setCategoryFilter(null)}
							/>
						)}
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
					</ScrollView>

					<BottomSheetSectionList
						sections={sections}
						keyExtractor={(item: Transaction) => item.id}
						stickySectionHeadersEnabled
						showsVerticalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						contentContainerStyle={{
							paddingHorizontal: 18,
							// Clear of the pinned buttons, and of the title row the
							// content steps down for.
							paddingBottom: FOOTER_HEIGHT + TITLE_HEIGHT + 24,
						}}
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
										: folded
											? `"${query.trim()}" bo'yicha ${monthName(month).toLowerCase()}da yozuv yo'q`
											: `Bu filtr bo'yicha ${monthName(month).toLowerCase()}da yozuv yo'q`
								}
							/>
						}
					/>
				</Animated.View>
			</Animated.View>

			<Select
				label="Kategoriya bo'yicha"
				value={categoryFilter}
				onChange={setCategoryFilter}
				sections={categorySections}
				clearable
				emptyMessage={`${monthName(month)}da hali yozuv yo'q.`}
				open={categoryPickerOpen}
				onOpenChange={setCategoryPickerOpen}
				trigger={() => null}
			/>
		</BottomSheet>
	);
}

/** The grabber. Dragging it (or anywhere on the panel) moves the sheet; a tap doesn't. */
function SheetHandle() {
	const { isDark } = useTheme();
	const { expand } = useBottomSheet();

	return (
		<View
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel="Oyning barcha yozuvlari"
			accessibilityHint="Ochish uchun yuqoriga torting"
			accessibilityActions={[{ name: "activate" }, { name: "increment" }]}
			onAccessibilityAction={() => expand()}
			style={{ height: HANDLE_HEIGHT, alignItems: "center", paddingTop: 10 }}
		>
			<View
				style={{
					width: 38,
					height: 5,
					borderRadius: 3,
					backgroundColor: isDark ? "rgba(232,238,246,0.22)" : "rgba(11,27,46,0.16)",
				}}
			/>
		</View>
	);
}

/** Frosted over the sky at rest, the sheet's solid white once it's up. */
function SheetBackground({ style, animatedIndex }: BottomSheetBackgroundProps) {
	const { tc, isDark } = useTheme();
	const sky = homePalette(isDark);
	const solidStyle = useAnimatedStyle(() => ({
		opacity: interpolate(animatedIndex.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
	}));

	return (
		<View
			pointerEvents="none"
			style={[
				style,
				{
					backgroundColor: sky.glass,
					borderTopLeftRadius: RADIUS.sheet,
					borderTopRightRadius: RADIUS.sheet,
					overflow: "hidden",
				},
			]}
		>
			<Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: tc.background }, solidStyle]} />
		</View>
	);
}

/** Kirim / Chiqim, pinned to the bottom; the list fades out behind them once it's up. */
function SheetFooter({ onIncome, onExpense }: { onIncome: () => void; onExpense: () => void }) {
	const { tc } = useTheme();
	const { animatedIndex } = useBottomSheet();
	const fadeStyle = useAnimatedStyle(() => ({
		opacity: interpolate(animatedIndex.get(), [0, 1], [0, 1], Extrapolation.CLAMP),
	}));

	return (
		<View style={{ height: FOOTER_HEIGHT, justifyContent: "flex-end" }}>
			<Animated.View
				pointerEvents="none"
				style={[{ position: "absolute", left: 0, right: 0, bottom: 0, height: FOOTER_HEIGHT + 40 }, fadeStyle]}
			>
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id="ledger-footer-fade" x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor={tc.background} stopOpacity={0} />
							<Stop offset="0.45" stopColor={tc.background} stopOpacity={1} />
						</LinearGradient>
					</Defs>
					<Rect x="0" y="0" width="100%" height="100%" fill="url(#ledger-footer-fade)" />
				</Svg>
			</Animated.View>
			<View className="flex-row" style={{ gap: 4, paddingHorizontal: 18, paddingBottom: 16 }}>
				<View className="flex-1">
					<Button
						label="Kirim"
						variant="soft"
						color="success"
						size="lg"
						fullWidth
						accessibilityLabel="Kirim qo'shish"
						startIcon={<Ionicons name="add" size={20} color={tc.success} />}
						onPress={onIncome}
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
						onPress={onExpense}
					/>
				</View>
			</View>
		</View>
	);
}

/**
 * The month's income or spending. At rest it opens the ledger on that side;
 * with the ledger up it narrows the list to that side and back — the soft
 * tint and the tick saying so.
 */
function SideTotal({
	type,
	text,
	active,
	onPress,
}: {
	type: TxType;
	text: string;
	active: boolean;
	onPress: () => void;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const sky = homePalette(isDark);
	const income = type === "income";
	const tone = income ? tc.success : tc.danger;
	const label = income ? "Kirim" : "Chiqim";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${text}`}
			accessibilityState={{ selected: active }}
			onPress={onPress}
			className="flex-1 active:opacity-70"
			style={{
				gap: 3,
				borderRadius: 18,
				paddingVertical: 8,
				paddingHorizontal: 10,
				backgroundColor: active ? (income ? tc.successSoft : tc.dangerSoft) : "transparent",
			}}
		>
			<View className="flex-row items-center gap-1.5">
				<Ionicons name={income ? "arrow-down" : "arrow-up"} size={13} color={tone} />
				<Text className="font-semibold" style={{ fontSize: tf.xs + 1, color: sky.glassMuted }}>
					{label}
				</Text>
			</View>
			<Text
				className="font-extrabold text-foreground"
				style={{ fontSize: tf.xl + 1, letterSpacing: -0.2, paddingRight: active ? 24 : 0 }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{text}
			</Text>
			{active && (
				<View
					className="absolute items-center justify-center"
					style={{ top: 8, right: 8, width: 22, height: 22, borderRadius: 11, backgroundColor: tone }}
				>
					<Ionicons name="checkmark" size={13} color="#fff" />
				</View>
			)}
		</Pressable>
	);
}
