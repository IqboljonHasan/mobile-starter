import BottomSheet, {
	type BottomSheetBackgroundProps,
	BottomSheetFooter,
	type BottomSheetFooterProps,
	BottomSheetSectionList,
	useBottomSheet,
} from "@gorhom/bottom-sheet";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "expo-router";
import { type ReactNode, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { BackHandler, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
	Extrapolation,
	interpolate,
	type SharedValue,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import CategoryAvatar from "@/components/CategoryAvatar";
import ContactAvatar from "@/components/ContactAvatar";
import MonthSwitcher from "@/components/MonthSwitcher";
import SearchBar from "@/components/SearchBar";
import TransactionRow from "@/components/TransactionRow";
import WalletIcon from "@/components/WalletIcon";
import ScrollShadow from "@/components/ScrollShadow";
import { Button, Chip, EmptyState, HeaderMenu, PillTabs, Select } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useStickyHeaderShadow } from "@/hooks/useStickyHeaderShadow";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { currentMonthKey, formatSectionDay, monthName, shiftMonth } from "@/lib/date";
import { countedForStats, inMonth, resolveCategory, unitsUsed } from "@/lib/ledger";
import { formatAmount, maskAmount } from "@/lib/money";
import { foldForSearch, matchesSearch } from "@/lib/search";
import { homePalette, RADIUS } from "@/lib/theme";
import type { FamilyMember, Transaction, TxType } from "@/lib/types";
import { UNALLOCATED_ID, UNALLOCATED_NAME, walletShare } from "@/lib/wallets";

type TypeFilter = "all" | TxType;

/** The member filter's key for expenses that aren't for one person: shared,
 *  or for a member since deleted. Member ids are "mem_…", so this can't clash. */
const COMMON_MEMBER_ID = "common";

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
/** A day's header in the list — the same for every day, so the shade can sit
 *  right under whichever one is stuck at the top. */
const SECTION_HEADER_HEIGHT = 40;

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
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const { transactions, categories, wallets, members, debts, defaultUnit } = useLedger();
	const { hideIncome, includeDebtsInStats, uncollectedLoansAsExpense } = usePreferences();

	const sheet = useRef<BottomSheet>(null);
	const animatedIndex = useSharedValue(0);
	const [expanded, setExpanded] = useState(false);
	const [blockHeight, setBlockHeight] = useState(150);

	const [type, setType] = useState<TypeFilter>("all");
	const [walletFilter, setWalletFilter] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [subcategoryFilter, setSubcategoryFilter] = useState<string | null>(null);
	const [memberFilter, setMemberFilter] = useState<string | null>(null);
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
	const [searching, setSearching] = useState(false);
	const [query, setQuery] = useState("");
	// What the list is scrolling under: the stuck day header, or the filters
	// above it while the next day pushes that header out.
	const { edge, listProps } = useStickyHeaderShadow(SECTION_HEADER_HEIGHT);

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

	// A sideways swipe moves the month: left for the next, right for the one
	// before — the same two steps the arrows take, and like them it stops at
	// the current month. It only takes over from a clearly horizontal drag, so
	// scrolling the list and pulling the sheet are left alone. One gesture per
	// place it is attached: the panel, and the list under the filter chips
	// (which scroll sideways themselves).
	const swipeMonth = Gesture.Pan()
		.runOnJS(true)
		.activeOffsetX([-18, 18])
		.failOffsetY([-14, 14])
		.onEnd((e) => {
			if (Math.abs(e.translationX) < 60 && Math.abs(e.velocityX) < 600) return;
			const next = shiftMonth(month, e.translationX < 0 ? 1 : -1);
			if (next <= currentMonthKey()) onMonthChange(next);
		});
	const swipeMonthList = Gesture.Pan()
		.runOnJS(true)
		.activeOffsetX([-18, 18])
		.failOffsetY([-14, 14])
		.onEnd((e) => {
			if (Math.abs(e.translationX) < 60 && Math.abs(e.velocityX) < 600) return;
			const next = shiftMonth(month, e.translationX < 0 ? 1 : -1);
			if (next <= currentMonthKey()) onMonthChange(next);
		});

	// At rest a side's total opens the ledger on that side; with the ledger up
	// it narrows the list to that side and back.
	const pickSide = (side: TxType) => {
		if (expanded) {
			const next = type === side ? "all" : side;
			setType(next);
			// A category from the other side would leave the list empty.
			const picked = categories.find((c) => c.id === categoryFilter);
			if (picked && next !== "all" && picked.type !== next) pickCategory(null);
			// Members are only on expenses, so a member pick can't meet income.
			if (next === "income") setMemberFilter(null);
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
		setSubcategoryFilter(null);
		setMemberFilter(null);
		setSearching(false);
		setQuery("");
	};

	/* The month's entries -------------------------------------------------- */

	const monthly = useMemo(() => inMonth(transactions, month), [transactions, month]);

	// Everything that narrows the list except the side, which the totals show
	// both of: the wallet (by share), the category, and the search — which
	// reads what a row shows: its note, its category and subcategory, who it
	// was spent on, and the amount's digits.
	const folded = foldForSearch(query);
	const narrowed = useMemo(
		() =>
			monthly.filter((t) => {
				if (categoryFilter && t.categoryId !== categoryFilter) return false;
				if (subcategoryFilter && t.subcategoryId !== subcategoryFilter) return false;
				if (memberFilter && (t.type !== "expense" || memberKeyOf(t, members) !== memberFilter)) return false;
				if (walletShare(t, walletFilter) <= 0) return false;
				if (!folded) return true;
				const { category, subcategory } = resolveCategory(t, categories);
				const member = t.memberId ? members.find((m) => m.id === t.memberId) : undefined;
				return matchesSearch(folded, [
					t.description,
					category?.name,
					subcategory?.name,
					member?.name,
					String(t.amount),
				]);
			}),
		[monthly, categoryFilter, subcategoryFilter, memberFilter, walletFilter, folded, categories, members],
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
		const counted =
			categoryFilter || subcategoryFilter
				? narrowed
				: countedForStats(narrowed, debts, {
						includeDebts: includeDebtsInStats,
						uncollectedLoans: uncollectedLoansAsExpense,
					});
		let income = 0;
		let expense = 0;
		for (const t of counted) {
			if (t.unit !== unit) continue;
			if (t.type === "income") income += walletShare(t, walletFilter);
			else expense += walletShare(t, walletFilter);
		}
		return { income, expense };
	}, [
		narrowed,
		debts,
		categoryFilter,
		subcategoryFilter,
		includeDebtsInStats,
		uncollectedLoansAsExpense,
		unit,
		walletFilter,
	]);

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
					const signed = (t.type === "income" ? 1 : -1) * walletShare(t, walletFilter);
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

	// Only subcategories that have entries this month on the side shown, and
	// inside the picked category when there is one — grouped by category.
	const subcategorySections = useMemo(() => {
		const used = new Map<string, Set<string>>();
		for (const t of monthly) {
			if (!t.subcategoryId) continue;
			if (type !== "all" && t.type !== type) continue;
			if (categoryFilter && t.categoryId !== categoryFilter) continue;
			const set = used.get(t.categoryId) ?? new Set<string>();
			set.add(t.subcategoryId);
			used.set(t.categoryId, set);
		}
		return categories
			.filter((c) => used.has(c.id))
			.map((c) => ({
				title: c.name,
				options: c.subcategories
					.filter((sub) => used.get(c.id)?.has(sub.id))
					.map((sub) => ({ key: sub.id, label: sub.name })),
			}))
			.filter((section) => section.options.length > 0);
	}, [monthly, categories, type, categoryFilter]);
	const pickedSubcategory =
		pickedCategory?.subcategories.find((sub) => sub.id === subcategoryFilter) ??
		categories.flatMap((c) => c.subcategories).find((sub) => sub.id === subcategoryFilter) ??
		null;

	// The pool is offered only once an entry this month has reached it.
	const walletOptions = useMemo(
		() => [
			...wallets.map((w) => ({ key: w.id, label: w.name })),
			...(monthly.some((t) => walletShare(t, UNALLOCATED_ID) > 0)
				? [{ key: UNALLOCATED_ID, label: UNALLOCATED_NAME }]
				: []),
		],
		[wallets, monthly],
	);
	const pickedWallet = walletOptions.find((w) => w.key === walletFilter) ?? null;

	// A subcategory belongs to one category: another category drops it, and
	// picking one picks its category too, so the two chips never disagree.
	function pickCategory(next: string | null) {
		setCategoryFilter(next);
		const parent = categories.find((c) => c.subcategories.some((sub) => sub.id === subcategoryFilter));
		if (!next || parent?.id !== next) setSubcategoryFilter(null);
	}
	const pickSubcategory = (next: string | null) => {
		setSubcategoryFilter(next);
		const parent = categories.find((c) => c.subcategories.some((sub) => sub.id === next));
		if (parent) setCategoryFilter(parent.id);
	};
	const filtering =
		walletFilter !== null || categoryFilter !== null || subcategoryFilter !== null || memberFilter !== null;

	// How many of the month's entries (on the side shown) each option would
	// leave in the list, so a pick says what it's worth before it's made.
	const counts = useMemo(() => {
		const wallet = new Map<string, number>();
		const category = new Map<string, number>();
		const subcategory = new Map<string, number>();
		const member = new Map<string, number>();
		const bump = (map: Map<string, number>, key: string) => map.set(key, (map.get(key) ?? 0) + 1);
		for (const t of monthly) {
			if (type !== "all" && t.type !== type) continue;
			bump(category, t.categoryId);
			if (t.subcategoryId) bump(subcategory, t.subcategoryId);
			if (t.type === "expense") bump(member, memberKeyOf(t, members));
			for (const w of [...wallets.map((x) => x.id), UNALLOCATED_ID]) {
				if (walletShare(t, w) > 0) bump(wallet, w);
			}
		}
		return { wallet, category, subcategory, member };
	}, [monthly, type, wallets, members]);
	// Only members with expenses this month are offered, the shared bucket last.
	const memberOptions = useMemo(
		() => [
			...members.filter((m) => counts.member.has(m.id)).map((m) => ({ key: m.id, label: m.name })),
			...(counts.member.has(COMMON_MEMBER_ID) ? [{ key: COMMON_MEMBER_ID, label: "Umumiy" }] : []),
		],
		[members, counts],
	);
	const pickedMember = memberOptions.find((m) => m.key === memberFilter) ?? null;
	const countText = (map: Map<string, number>, key: string) => `${map.get(key) ?? 0} ta yozuv`;

	const renderWalletOption = (option: { key: string; label: string }, selected: boolean) => {
		const wallet = wallets.find((w) => w.id === option.key);
		return (
			<OptionRow
				selected={selected}
				title={option.label}
				subtitle={countText(counts.wallet, option.key)}
				leading={
					<WalletIcon icon={wallet?.icon ?? null} color={wallet?.color ?? "blue"} size={38} />
				}
			/>
		);
	};
	const renderCategoryOption = (option: { key: string; label: string }, selected: boolean) => {
		const category = categories.find((c) => c.id === option.key);
		return (
			<OptionRow
				selected={selected}
				title={option.label}
				subtitle={countText(counts.category, option.key)}
				leading={
					<CategoryAvatar
						icon={category?.icon ?? "help-outline"}
						color={category?.color ?? "blue"}
						size={38}
					/>
				}
			/>
		);
	};
	const renderSubcategoryOption = (option: { key: string; label: string }, selected: boolean) => {
		const parent = categories.find((c) => c.subcategories.some((sub) => sub.id === option.key));
		const sub = parent?.subcategories.find((x) => x.id === option.key);
		return (
			<OptionRow
				selected={selected}
				title={option.label}
				subtitle={`${parent?.name ?? ""} · ${countText(counts.subcategory, option.key)}`}
				leading={
					<CategoryAvatar
						icon={parent?.icon ?? "pricetag-outline"}
						color={sub?.color ?? parent?.color ?? "blue"}
						size={38}
					/>
				}
			/>
		);
	};

	const renderMemberOption = (option: { key: string; label: string }, selected: boolean) => {
		const member = members.find((m) => m.id === option.key);
		return (
			<OptionRow
				selected={selected}
				title={option.label}
				subtitle={countText(counts.member, option.key)}
				leading={
					member ? (
						<ContactAvatar name={member.name} id={member.id} color={member.color} size={38} />
					) : (
						<CategoryAvatar icon="people-outline" color="blue" size={38} mono />
					)
				}
			/>
		);
	};

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

	// A day's header is opaque so rows slide under it, but the sheet behind it
	// is already whitening on the way up — a header fading in alongside would
	// add its own white on top and get there first. It takes over only once the
	// sheet is all but solid.
	const headerBackdropStyle = useAnimatedStyle(() => ({
		opacity: interpolate(animatedIndex.get(), [0.9, 1], [0, 1], Extrapolation.CLAMP),
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
			// Only an up-or-down drag moves the sheet. Without these it took any
			// drag past a few pixels — sideways too — and the month swipe
			// underneath never got a turn.
			activeOffsetY={[-10, 10]}
			failOffsetX={[-12, 12]}
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
							<Text
								accessibilityRole="header"
								className="flex-1 font-extrabold text-foreground ml-1.5"
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
									{
										key: "categories",
										label: "Kategoriyalar",
										icon: "pricetags-outline",
										separatorBefore: true,
										onPress: () => router.push("/categories"),
									},
									{
										key: "members",
										label: "Oila a'zolari",
										icon: "people-outline",
										onPress: () => router.push("/members"),
									},
								]}
							/>
						</>
					)}
				</View>
			</Animated.View>

			<Animated.View style={[{ flex: 1 }, bodyStyle]}>
				{/* The panel itself: month and its totals ----------------------- */}
				<GestureDetector gesture={swipeMonth}>
					<View
						onLayout={(e) => setBlockHeight(Math.round(e.nativeEvent.layout.height))}
						style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 14, gap: 14 }}
					>
						<View className="flex-row items-center" style={{ gap: 8 }}>
							<View className="flex-1">
								<MonthSwitcher value={month} onChange={onMonthChange} surface="glass" />
							</View>
							{units.length > 1 && (
								<PillTabs
									compact
									items={units.map((code) => ({ key: code, label: code }))}
									value={unit}
									onChange={setPickedUnit}
								/>
							)}
						</View>
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
				</GestureDetector>

				{/* The ledger: filters, then the days --------------------------- */}
				<Animated.View style={[{ flex: 1 }, ledgerStyle]} pointerEvents={expanded ? "auto" : "none"}>
					<ScrollView
						horizontal
						accessibilityLabel="Filtrlar"
						showsHorizontalScrollIndicator={false}
						style={{ flexGrow: 0 }}
						contentContainerStyle={{ gap: 6, paddingHorizontal: 18, paddingBottom: 8 }}
					>
						<Select
							label="Hamyon"
							value={walletFilter}
							onChange={setWalletFilter}
							options={walletOptions}
							renderOption={renderWalletOption}
							clearable
							emptyMessage="Hali hamyon yo'q."
							trigger={({ open }) => (
								<Chip
									label={pickedWallet?.label ?? "Hamyon"}
									dot={
										walletFilter && walletFilter !== UNALLOCATED_ID
											? categoryColorValue(
													wallets.find((w) => w.id === walletFilter)?.color ?? "blue",
													isDark,
												)
											: undefined
									}
									icon="chevron-down"
									active={walletFilter !== null}
									accessibilityLabel={`Hamyon: ${pickedWallet?.label ?? "hammasi"}`}
									onPress={open}
								/>
							)}
						/>
						<Select
							label="Kategoriya"
							value={categoryFilter}
							onChange={pickCategory}
							sections={categorySections}
							renderOption={renderCategoryOption}
							clearable
							emptyMessage={`${monthName(month)}da hali yozuv yo'q.`}
							open={categoryPickerOpen}
							onOpenChange={setCategoryPickerOpen}
							trigger={({ open }) => (
								<Chip
									label={pickedCategory?.name ?? "Kategoriya"}
									icon="chevron-down"
									active={categoryFilter !== null}
									accessibilityLabel={`Kategoriya: ${pickedCategory?.name ?? "hammasi"}`}
									onPress={open}
								/>
							)}
						/>
						<Select
							label="Subkategoriya"
							value={subcategoryFilter}
							onChange={pickSubcategory}
							sections={subcategorySections}
							renderOption={renderSubcategoryOption}
							clearable
							emptyMessage={
								pickedCategory
									? `${monthName(month)}da "${pickedCategory.name}" ichida subkategoriyali yozuv yo'q.`
									: `${monthName(month)}da subkategoriyali yozuv yo'q.`
							}
							trigger={({ open }) => (
								<Chip
									label={pickedSubcategory?.name ?? "Subkategoriya"}
									icon="chevron-down"
									active={subcategoryFilter !== null}
									accessibilityLabel={`Subkategoriya: ${pickedSubcategory?.name ?? "hammasi"}`}
									onPress={open}
								/>
							)}
						/>
						{members.length > 0 && (
							<Select
								label="A'zo"
								value={memberFilter}
								onChange={setMemberFilter}
								options={memberOptions}
								renderOption={renderMemberOption}
								clearable
								emptyMessage={`${monthName(month)}da a'zolarga yozilgan chiqim yo'q.`}
								trigger={({ open }) => (
									<Chip
										label={pickedMember?.label ?? "A'zo"}
										dot={
											memberFilter && memberFilter !== COMMON_MEMBER_ID
												? categoryColorValue(
														members.find((m) => m.id === memberFilter)?.color ?? "blue",
														isDark,
													)
												: undefined
										}
										icon="chevron-down"
										active={memberFilter !== null}
										accessibilityLabel={`A'zo: ${pickedMember?.label ?? "hammasi"}`}
										onPress={open}
									/>
								)}
							/>
						)}
						{filtering && (
							<Pressable
								accessibilityRole="button"
								accessibilityLabel="Filtrlarni tozalash"
								onPress={() => {
									setWalletFilter(null);
									setCategoryFilter(null);
									setSubcategoryFilter(null);
									setMemberFilter(null);
								}}
								className="items-center justify-center rounded-full bg-muted active:opacity-70"
								style={{ width: 40, height: 40 }}
							>
								<Ionicons name="close" size={18} color={tc.foreground} />
							</Pressable>
						)}
					</ScrollView>

					<GestureDetector gesture={swipeMonthList}>
						<View style={{ flex: 1 }}>
							<BottomSheetSectionList
								sections={sections}
								keyExtractor={(item: Transaction) => item.id}
								stickySectionHeadersEnabled
								showsVerticalScrollIndicator={false}
								keyboardShouldPersistTaps="handled"
								{...listProps}
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
											className="flex-row items-center justify-between"
											style={{ height: SECTION_HEADER_HEIGHT }}
										>
											<Animated.View
												pointerEvents="none"
												style={[StyleSheet.absoluteFill, { backgroundColor: tc.background }, headerBackdropStyle]}
											/>
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
								// The gap between days goes after each day rather than as a
								// margin on the next header: a stuck header would carry the
								// margin with it, a see-through strip rows show through.
								renderSectionFooter={() => <View style={{ height: 8 }} />}
								renderItem={({ item, index }) => (
									<TransactionRow
										transaction={item}
										categories={categories}
										divider={index > 0}
										amountOverride={walletFilter ? walletShare(item, walletFilter) : undefined}
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
							<ScrollShadow visible={edge === "header"} top={SECTION_HEADER_HEIGHT} />
							<ScrollShadow visible={edge === "top"} />
						</View>
					</GestureDetector>
				</Animated.View>
			</Animated.View>

		</BottomSheet>
	);
}

/** Who an expense is for: its member while that member exists, otherwise the shared bucket —
 *  a deleted member's expenses read as for everybody, as they do in the form. */
function memberKeyOf(t: Transaction, members: FamilyMember[]): string {
	return t.memberId && members.some((m) => m.id === t.memberId) ? t.memberId : COMMON_MEMBER_ID;
}

/** One row of a filter sheet: a tile saying what it is, its name, and what picking it leaves. */
function OptionRow({
	leading,
	title,
	subtitle,
	selected,
}: {
	leading: ReactNode;
	title: string;
	subtitle: string;
	selected: boolean;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	return (
		<View className="flex-row items-center gap-3 py-2.5">
			{leading}
			<View className="flex-1">
				<Text
					className={`text-foreground ${selected ? "font-extrabold" : "font-semibold"}`}
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{title}
				</Text>
				<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm }} numberOfLines={1}>
					{subtitle}
				</Text>
			</View>
			{selected && <Ionicons name="checkmark-circle" size={22} color={tc.foreground} />}
		</View>
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
