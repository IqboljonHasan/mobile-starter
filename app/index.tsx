import { Ionicons } from "@expo/vector-icons";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeSky from "@/components/HomeSky";
import LedgerSheet, { type LedgerSheetHandle } from "@/components/LedgerSheet";
import WalletIcon from "@/components/WalletIcon";
import { IconButton, Select } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useDoubleBackToExit } from "@/hooks/useDoubleBackToExit";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, softTint } from "@/lib/categoryColors";
import { currentMonthKey } from "@/lib/date";
import { outstandingByUnit } from "@/lib/debts";
import { excludeDebts, inMonth, inUnit, ofType, sum } from "@/lib/ledger";
import { formatAmount, formatCompact, maskAmount, unitByCode } from "@/lib/money";
import { homePalette } from "@/lib/theme";
import { walletBalances, walletUnitsUsed } from "@/lib/wallets";
import "../global.css";

const TILE_W = 116;
const TILE_GAP = 4;
// The room between the balance and the wallets: this much when the screen has
// it to spare, squeezed to the minimum when it doesn't.
const WALLETS_GAP = 56;
const WALLETS_GAP_MIN = 16;

/**
 * Home, top to bottom in the order the questions come: how much do I have and
 * how did this month move it; what each wallet holds; what is owed either
 * way. The month itself sits in the panel at the bottom with the two things
 * done most — adding money in and money out — so they never scroll away.
 *
 * The screen doesn't scroll on its own: the panel is the top of the month's
 * ledger (LedgerSheet), and pulling it up scrolls Home away above it until
 * the ledger has the screen. Every figure is a way in — a wallet pulls the
 * ledger up narrowed to it, the month's income or spending on that side, and
 * the debts card opens the debts.
 */
export default function HomeScreen() {
	const router = useRouter();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const insets = useSafeAreaInsets();
	const sky = homePalette(isDark);
	const { ready, transactions, wallets, transfers, debts, defaultUnit } = useLedger();
	const { hideIncome, toggleHideIncome, includeDebtsInStats } = usePreferences();
	useDoubleBackToExit();

	const [month, setMonth] = useState(currentMonthKey);
	const [pickedWalletUnit, setPickedWalletUnit] = useState<string | null>(null);
	const [panelHeight, setPanelHeight] = useState(272);
	const [screenHeight, setScreenHeight] = useState(0);
	const [balanceHeight, setBalanceHeight] = useState(0);
	const [cardsHeight, setCardsHeight] = useState(0);
	const ledger = useRef<LedgerSheetHandle>(null);

	// Home scrolls with the ledger: whatever the sheet's top edge has risen
	// above its resting place, the content above it has gone up by the same.
	// Starts below any screen, so nothing moves before the sheet has reported in.
	const sheetTop = useSharedValue(100_000);
	const restingTop = screenHeight - panelHeight;
	// Home sits above the panel, never under it: the gap under the balance gives
	// first, and what still doesn't fit scrolls inside the room above the panel.
	const contentTop = insets.top + 12;
	const walletsGap = Math.round(
		Math.max(
			WALLETS_GAP_MIN,
			Math.min(WALLETS_GAP, restingTop - (contentTop + balanceHeight + cardsHeight)),
		),
	);
	const contentStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: screenHeight ? Math.min(sheetTop.get() - restingTop, 0) : 0 }],
	}));
	// Up at the top, the ledger sits on the same navy as every other sheet, so
	// the sky darkens behind it on the way.
	const openTop = insets.top + 8;
	const backdropStyle = useAnimatedStyle(() => ({
		opacity: screenHeight
			? interpolate(sheetTop.get(), [restingTop, openTop], [0, 1], Extrapolation.CLAMP)
			: 0,
	}));

	// The balance is deliberately independent of the month in the panel: what
	// a jar holds is an all-time running balance, not something a month resets,
	// so it picks its own unit from everything the wallets have ever touched.
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
	// Everything held, jars and the unallocated pool alike — a transfer moves
	// money between them without changing this sum.
	const total = balances.reduce((acc, b) => acc + b.balance, 0);

	// What this calendar month has done to the balance so far — always the
	// current month, whatever the panel below is showing, since it reads "bu oy".
	const thisMonthNet = useMemo(() => {
		const scoped = inMonth(inUnit(transactions, walletUnit), currentMonthKey());
		const counted = includeDebtsInStats ? scoped : excludeDebts(scoped);
		return {
			count: counted.length,
			net: sum(ofType(counted, "income")) - sum(ofType(counted, "expense")),
		};
	}, [transactions, walletUnit, includeDebtsInStats]);

	// Debts in the balance's unit when there are any, otherwise in whichever
	// unit holds the most — never summed across currencies.
	const debtTotal = useMemo(() => {
		const totals = outstandingByUnit(debts);
		return totals.find((t) => t.unit === walletUnit) ?? totals[0] ?? null;
	}, [debts, walletUnit]);
	const debtUnit = debtTotal?.unit ?? walletUnit;

	const { symbol, position } = unitByCode(walletUnit);
	const hero = Math.round(tf.xxxl * 1.7);
	const glass = { backgroundColor: sky.glass };

	if (!ready) {
		return (
			<View className="flex-1">
				<HomeSky />
				<View className="flex-1 items-center justify-center">
					<ActivityIndicator color="#fff" />
				</View>
			</View>
		);
	}

	return (
		<View className="flex-1" onLayout={(e) => setScreenHeight(e.nativeEvent.layout.height)}>
			<HomeSky />

			<Animated.View style={[screenHeight ? { height: restingTop } : null, contentStyle]}>
				<ScrollView
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingTop: contentTop, paddingHorizontal: 18 }}
				>
					{/* Balance ------------------------------------------------------ */}
					<View
						accessibilityLabel="Jami balans"
						onLayout={(e) => setBalanceHeight(Math.round(e.nativeEvent.layout.height))}
					>
						{/* The label shares its row with the screen's controls, as the
						    prototype draws it — the figure under them is the headline. */}
						<View className="flex-row items-center gap-1" style={{ minHeight: 44 }}>
							<Text className="font-semibold" style={{ fontSize: tf.base, color: "#fff" }}>
								Jami balans
							</Text>
							<Pressable
								accessibilityRole="button"
								accessibilityLabel={hideIncome ? "Summalarni ko'rsatish" : "Summalarni yashirish"}
								accessibilityState={{ selected: hideIncome }}
								onPress={toggleHideIncome}
								hitSlop={10}
								className="w-9 h-9 items-center justify-center active:opacity-60"
							>
								<Ionicons name={hideIncome ? "eye-off-outline" : "eye-outline"} size={21} color="#fff" />
							</Pressable>

							<View className="flex-row items-center gap-1 ml-auto">
								{walletUnits.length > 1 && (
									<Select
										label="Balans valyutasi"
										value={walletUnit}
										toggleOff={false}
										onChange={(next) => next && setPickedWalletUnit(next)}
										options={walletUnits.map((code) => ({
											key: code,
											label: `${code} — ${unitByCode(code).name}`,
										}))}
										trigger={({ open }) => (
											<Pressable
												accessibilityRole="button"
												accessibilityLabel={`Balans valyutasi: ${walletUnit}`}
												onPress={open}
												className="flex-row items-center gap-1 rounded-full px-4 active:opacity-70"
												style={{ height: 44, backgroundColor: "rgba(255,255,255,0.16)" }}
											>
												<Text className="font-bold" style={{ fontSize: tf.sm, color: "#fff" }}>
													{walletUnit}
												</Text>
												<Ionicons name="chevron-down" size={14} color="#fff" />
											</Pressable>
										)}
									/>
								)}
								<IconButton
									variant="glass"
									icon="settings-outline"
									accessibilityLabel="Sozlamalar"
									onPress={() => router.push("/settings")}
								/>
							</View>
						</View>
						<View
							accessible
							accessibilityLabel={hideIncome ? "Balans yashirilgan" : formatAmount(total, walletUnit)}
							className="flex-row items-baseline gap-2"
						>
							<Text
								className="font-extrabold"
								style={{ fontSize: hero, letterSpacing: -1.5, color: "#fff", flexShrink: 1 }}
								numberOfLines={1}
								adjustsFontSizeToFit
							>
								{position === "before" && !hideIncome ? symbol : ""}
								{hideIncome ? "••••" : formatAmount(total, walletUnit, { showUnit: false })}
							</Text>
							{position === "after" && (
								<Text className="font-bold" style={{ fontSize: tf.lg + 1, color: "#fff" }}>
									{symbol}
								</Text>
							)}
						</View>

						{thisMonthNet.count > 0 && (
							<View
								className="flex-row items-center self-start rounded-full mt-3.5"
								style={{ height: 34, paddingHorizontal: 14, gap: 6, backgroundColor: sky.chip }}
							>
								{!hideIncome && thisMonthNet.net !== 0 && (
									<Ionicons
										name={thisMonthNet.net > 0 ? "arrow-up" : "arrow-down"}
										size={14}
										color={thisMonthNet.net > 0 ? "#4ade80" : "#fca5a5"}
										style={{ transform: [{ rotate: "45deg" }] }}
									/>
								)}
								<Text className="font-bold" style={{ fontSize: tf.sm, color: "#fff" }}>
									{`${
										hideIncome
											? maskAmount(walletUnit)
											: formatAmount(thisMonthNet.net, walletUnit, { signed: true })
									} bu oy`}
								</Text>
							</View>
						)}
					</View>

					<View style={{ height: walletsGap }} />
					<View
						style={{ paddingBottom: 12 }}
						onLayout={(e) => setCardsHeight(Math.round(e.nativeEvent.layout.height))}
					>
					{/* Wallets ------------------------------------------------------ */}
					<ScrollView
						horizontal
						accessibilityLabel="Hamyonlar"
						showsHorizontalScrollIndicator={false}
						snapToInterval={TILE_W + TILE_GAP}
						decelerationRate="fast"
						style={{ marginHorizontal: -18 }}
						contentContainerStyle={{ gap: TILE_GAP }}
					>
						{/* Read-only: the balances are shown here, and the last tile is
						    the way to the wallets themselves. */}
						{balances.map((b) => (
							<View
								key={b.walletId}
								accessible
								accessibilityLabel={`${b.name}, ${hideIncome ? "yashirilgan" : formatAmount(b.balance, walletUnit)}`}
								className="items-center justify-center"
								style={[glass, { width: TILE_W, height: 104, borderRadius: 22, gap: 12 }]}
							>
								<WalletIcon icon={b.icon} color={b.color} size={48} />
								<Text
									className="font-extrabold"
									style={{
										fontSize: tf.sm + 1,
										color: !hideIncome && b.balance < 0 ? tc.danger : tc.foreground,
									}}
									numberOfLines={1}
								>
									{hideIncome ? "••••" : formatCompact(b.balance, walletUnit)}
								</Text>
							</View>
						))}
						{/* The way to the jars themselves — their shares, transfers and
						    history — which no single tile opens. */}
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={wallets.length ? "Hamyonlarni boshqarish" : "Hamyon qo'shish"}
							onPress={() => router.push("/wallets")}
							className="items-center justify-center active:opacity-70"
							style={[glass, { width: TILE_W, height: 104, borderRadius: 22, gap: 12 }]}
						>
							<View
								className="items-center justify-center"
								style={{
									width: 48,
									height: 48,
									borderRadius: 16,
									backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(11,27,46,0.06)",
								}}
							>
								<Ionicons
									name={wallets.length ? "options-outline" : "add"}
									size={24}
									color={tc.foreground}
								/>
							</View>
							<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm + 1 }}>
								{wallets.length ? "Hamyonlar" : "Qo'shish"}
							</Text>
						</Pressable>
					</ScrollView>

					{/* Debts -------------------------------------------------------- */}
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`Qarzlar: berilgan ${formatAmount(debtTotal?.owedToMe ?? 0, debtUnit)}, olingan ${formatAmount(debtTotal?.owedByMe ?? 0, debtUnit)}`}
						onPress={() => router.push("/debts")}
						className="active:opacity-80"
						style={[
							glass,
							{ marginHorizontal: -18, marginTop: 20, borderRadius: 26, padding: 18, paddingTop: 16 },
						]}
					>
						<View className="flex-row items-center justify-between">
							<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
								Qarzlar
							</Text>
							<Ionicons name="chevron-forward" size={18} color={sky.glassMuted} />
						</View>
						<View className="flex-row mt-4">
							<DebtSide
								label="Berilgan"
								amount={debtTotal?.owedToMe ?? 0}
								unit={debtUnit}
								showUnit={debtUnit !== defaultUnit}
								given
							/>
							<View style={{ width: 1, backgroundColor: sky.glassDivider }} />
							<DebtSide
								label="Olingan"
								amount={debtTotal?.owedByMe ?? 0}
								unit={debtUnit}
								showUnit={debtUnit !== defaultUnit}
							/>
						</View>
					</Pressable>

					{/* Report ------------------------------------------------------- */}
					<Pressable
						accessibilityRole="button"
						onPress={() => router.push(`/stats?month=${month}`)}
						className="flex-row items-center gap-3 active:opacity-80"
						style={[
							glass,
							{ marginHorizontal: -18, marginTop: 12, borderRadius: 22, height: 64, paddingHorizontal: 18 },
						]}
					>
						<View
							className="items-center justify-center"
							style={{
								width: 40,
								height: 40,
								borderRadius: 14,
								backgroundColor: softTint(categoryColorValue("blue", isDark), isDark),
							}}
						>
							<Ionicons name="bar-chart-outline" size={20} color={categoryColorValue("blue", isDark)} />
						</View>
						<View className="flex-1 gap-px">
							<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
								Hisobot
							</Text>
							<Text className="font-semibold" style={{ fontSize: tf.sm - 1, color: sky.glassMuted }}>
								Kirim va chiqimlar tahlili
							</Text>
						</View>
						<Ionicons name="chevron-forward" size={18} color={sky.glassMuted} />
					</Pressable>
					</View>
				</ScrollView>
			</Animated.View>

			<Animated.View
				pointerEvents="none"
				style={[StyleSheet.absoluteFill, { backgroundColor: tc.backdrop }, backdropStyle]}
			/>

			{/* The month, and pulled up, its whole ledger --------------------- */}
			<LedgerSheet
				ref={ledger}
				month={month}
				onMonthChange={setMonth}
				animatedPosition={sheetTop}
				onCollapsedHeight={setPanelHeight}
			/>
		</View>
	);
}

/** One side of the debts card — what is owed to the user, or by them. */
function DebtSide({
	label,
	amount,
	unit,
	showUnit,
	given = false,
}: {
	label: string;
	amount: number;
	unit: string;
	showUnit: boolean;
	given?: boolean;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const sky = homePalette(isDark);

	return (
		<View className={`flex-1 flex-row items-center gap-3 ${given ? "pr-3" : "pl-4"}`}>
			<View
				className="items-center justify-center"
				style={{
					width: 40,
					height: 40,
					borderRadius: 14,
					backgroundColor: given ? tc.successSoft : tc.dangerSoft,
				}}
			>
				<Ionicons
					name={given ? "arrow-up" : "arrow-down"}
					size={20}
					color={given ? tc.success : tc.danger}
					style={{ transform: [{ rotate: "45deg" }] }}
				/>
			</View>
			<View className="flex-1 gap-0.5">
				<Text className="font-bold" style={{ fontSize: tf.xs + 1, color: sky.glassMuted }}>
					{label}
				</Text>
				<Text
					className="font-extrabold text-foreground"
					style={{ fontSize: tf.lg, letterSpacing: -0.2 }}
					numberOfLines={1}
					adjustsFontSizeToFit
				>
					{formatAmount(amount, unit, { showUnit })}
				</Text>
			</View>
		</View>
	);
}
