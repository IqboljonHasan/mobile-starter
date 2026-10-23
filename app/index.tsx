import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import HomeSky from "@/components/HomeSky";
import MonthSwitcher from "@/components/MonthSwitcher";
import WalletIcon from "@/components/WalletIcon";
import { Button, IconButton, PillTabs, Select } from "@/components/ui";
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
import { excludeDebts, inMonth, inUnit, ofType, sum, unitsUsed } from "@/lib/ledger";
import { formatAmount, formatCompact, maskAmount, unitByCode } from "@/lib/money";
import { periodSummary } from "@/lib/stats";
import { homePalette } from "@/lib/theme";
import { UNALLOCATED_ID, walletBalances, walletUnitsUsed } from "@/lib/wallets";
import "../global.css";

const TILE_W = 116;
const TILE_GAP = 4;

/**
 * Home, top to bottom in the order the questions come: how much do I have and
 * how did this month move it; what each wallet holds; what is owed either
 * way. The month itself sits in the panel at the bottom with the two things
 * done most — adding money in and money out — so they never scroll away.
 *
 * Every figure is a way in: a wallet opens the ledger narrowed to it, the
 * month's income or spending opens the ledger on that side, the debts card
 * opens the debts, and a swipe up on the panel opens the whole month.
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
	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [pickedWalletUnit, setPickedWalletUnit] = useState<string | null>(null);
	const [panelHeight, setPanelHeight] = useState(272);

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
	// stat below unless the user opts back in from Settings.
	const relevant = useMemo(() => {
		const scoped = inUnit(transactions, unit);
		return includeDebtsInStats ? scoped : excludeDebts(scoped);
	}, [transactions, unit, includeDebtsInStats]);
	const summary = useMemo(() => periodSummary(relevant, "month", month), [relevant, month]);

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

	const openMonth = () => router.push(`/entries?month=${month}`);

	// A swipe up on the panel pulls the month's whole ledger up, the way the
	// panel's handle suggests it would. Taps still reach the buttons: the pan
	// only takes over once the finger has moved.
	const swipeUp = Gesture.Pan()
		.runOnJS(true)
		.activeOffsetY(-16)
		.failOffsetX([-24, 24])
		.onEnd((e) => {
			if (e.translationY < -40) openMonth();
		});

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
		<View className="flex-1">
			<HomeSky />

			<ScrollView
				contentContainerStyle={{
					paddingTop: insets.top + 12,
					paddingHorizontal: 18,
					paddingBottom: panelHeight + 20,
				}}
				showsVerticalScrollIndicator={false}
			>
				{/* Balance ------------------------------------------------------ */}
				<View accessibilityLabel="Jami balans">
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

				{/* Wallets ------------------------------------------------------ */}
				<ScrollView
					horizontal
					accessibilityLabel="Hamyonlar"
					showsHorizontalScrollIndicator={false}
					snapToInterval={TILE_W + TILE_GAP}
					decelerationRate="fast"
					style={{ marginHorizontal: -18, marginTop: 56 }}
					contentContainerStyle={{ gap: TILE_GAP }}
				>
					{balances.map((b) => (
						<Pressable
							key={b.walletId}
							accessibilityRole="button"
							accessibilityLabel={`${b.name}, ${hideIncome ? "yashirilgan" : formatAmount(b.balance, walletUnit)}`}
							onPress={() =>
								b.walletId === UNALLOCATED_ID
									? router.push("/wallets")
									: router.push(`/entries?wallet=${b.walletId}`)
							}
							className="items-center justify-center active:opacity-70"
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
						</Pressable>
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
			</ScrollView>

			{/* The month panel -------------------------------------------------- */}
			<GestureDetector gesture={swipeUp}>
				<View
					onLayout={(e) => setPanelHeight(e.nativeEvent.layout.height)}
					style={[
						glass,
						{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: 0,
							borderTopLeftRadius: 32,
							borderTopRightRadius: 32,
							paddingHorizontal: 18,
							paddingTop: 10,
							paddingBottom: 16,
							gap: 14,
						},
					]}
				>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Oyning barcha yozuvlari"
						onPress={openMonth}
						hitSlop={{ top: 10, bottom: 6, left: 40, right: 40 }}
						className="self-center"
					>
						<View
							style={{
								width: 38,
								height: 5,
								borderRadius: 3,
								backgroundColor: isDark ? "rgba(232,238,246,0.22)" : "rgba(11,27,46,0.16)",
							}}
						/>
					</Pressable>

					<MonthSwitcher value={month} onChange={setMonth} surface="glass" />
					{units.length > 1 && (
						<PillTabs
							compact
							fill
							items={units.map((code) => ({ key: code, label: code }))}
							value={unit}
							onChange={setPickedUnit}
						/>
					)}

					<View className="flex-row">
						<MonthSide
							type="income"
							amount={summary.income}
							unit={unit}
							showUnit={unit !== defaultUnit}
							mask={hideIncome}
							onPress={() => router.push(`/entries?type=income&month=${month}`)}
						/>
						<View style={{ width: 1, backgroundColor: sky.glassDivider }} />
						<MonthSide
							type="expense"
							amount={summary.expense}
							unit={unit}
							showUnit={unit !== defaultUnit}
							mask={false}
							onPress={() => router.push(`/entries?type=expense&month=${month}`)}
						/>
					</View>

					<View className="flex-row" style={{ gap: 4 }}>
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
					</View>
				</View>
			</GestureDetector>
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

/** The month's income or spending in the panel — a way into that side of it. */
function MonthSide({
	type,
	amount,
	unit,
	showUnit,
	mask,
	onPress,
}: {
	type: "income" | "expense";
	amount: number;
	unit: string;
	showUnit: boolean;
	mask: boolean;
	onPress: () => void;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const sky = homePalette(isDark);
	const income = type === "income";
	const label = income ? "Kirim" : "Chiqim";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${label}, ${mask ? "yashirilgan" : formatAmount(amount, unit)}`}
			onPress={onPress}
			className={`flex-1 gap-1 active:opacity-70 ${income ? "pr-2.5" : "px-2.5"}`}
		>
			<View className="flex-row items-center gap-1.5">
				<Ionicons
					name={income ? "arrow-down" : "arrow-up"}
					size={13}
					color={income ? tc.success : tc.danger}
				/>
				<Text className="font-semibold" style={{ fontSize: tf.xs + 1, color: sky.glassMuted }}>
					{label}
				</Text>
			</View>
			<Text
				className="font-extrabold text-foreground"
				style={{ fontSize: tf.xl + 1, letterSpacing: -0.2 }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{mask ? maskAmount(unit) : formatAmount(amount, unit, { showUnit })}
			</Text>
		</Pressable>
	);
}
