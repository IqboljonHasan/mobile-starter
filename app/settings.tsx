import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack } from "expo-router";
import { type ReactNode, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Card, ListRow, SegmentedControl, Select, Toggle } from "@/components/ui";
import ScrollShadow from "@/components/ScrollShadow";
import {
	FONT_SCALE_LABELS,
	FONT_SCALE_VALUES,
	type FontSizeScale,
	useFontSize,
} from "@/contexts/FontSizeContext";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useTelegramBackup } from "@/contexts/TelegramBackupContext";
import { THEME_MODE_LABELS, type ThemeMode } from "@/contexts/ThemeContext";
import { useBackupShare } from "@/hooks/useBackupShare";
import { useFont } from "@/hooks/useFont";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { useScrolled } from "@/hooks/useScrolled";
import { prepareRestore, type WalletRestoreMode } from "@/lib/backup";
import { loadBackup } from "@/lib/backupFile";
import { UNITS, unitByCode } from "@/lib/money";
import { describeTelegramStatus } from "@/lib/telegramBackup";
import "../global.css";

const FONT_SCALES = Object.keys(FONT_SCALE_VALUES) as FontSizeScale[];

const THEME_ITEMS: { key: ThemeMode; label: string }[] = [
	{ key: "light", label: THEME_MODE_LABELS.light },
	{ key: "dark", label: THEME_MODE_LABELS.dark },
	{ key: "system", label: THEME_MODE_LABELS.system },
];

/**
 * Settings, in the groups the prototype draws — Ko'rinish, Taqsimot,
 * Maxfiylik, Ma'lumotlar — with every setting the app already had placed in
 * the group it belongs to.
 */
export default function SettingsScreen() {
	const router = useRouter();
	const { tc, isDark, mode, setMode } = useTheme();
	const { tf } = useFont();
	const { scale, setScale } = useFontSize();
	const {
		hideIncome,
		toggleHideIncome,
		includeDebtsInStats,
		setIncludeDebtsInStats,
		splitIncome,
		setSplitIncome,
	} = usePreferences();
	const {
		categories,
		transactions,
		wallets,
		contacts,
		debts,
		defaultUnit,
		setDefaultUnit,
		resetLedger,
		replaceLedger,
	} = useLedger();
	const telegram = useTelegramBackup();
	const backup = useBackupShare();

	// Sharing and restoring each open a system sheet, which leaves the app in
	// the background for as long as the user browses. Checking both keeps a
	// second sheet from being opened on top of the first.
	const [loading, setLoading] = useState(false);
	const { scrolled, scrollProps } = useScrolled();

	const appVersion = Constants.expoConfig?.version ?? "0.1.0";

	const runShare = () => {
		if (loading) return;
		backup.share();
	};

	const runLoad = async () => {
		if (loading || backup.sharing) return;
		setLoading(true);
		try {
			const result = await loadBackup();
			if (result.status === "canceled") return;
			if (result.status === "invalid") {
				Alert.alert("Tiklanmadi", result.error);
				return;
			}

			const { payload, skipped, hasWallets } = result;
			const restore = (mode: WalletRestoreMode) =>
				replaceLedger(prepareRestore(payload, hasWallets, mode, { wallets, categories }));
			// Both answers wipe the current ledger, so each button is itself the
			// confirmation — the question is only what the jars should hold after.
			Alert.alert(
				"Zaxiradan tiklansinmi?",
				`Fayldan ${payload.transactions.length} ta yozuv va ${payload.categories.length} ta kategoriya tiklanadi.` +
					(skipped > 0 ? ` ${skipped} ta buzuq yozuv o'tkazib yuborildi.` : "") +
					` Hozirgi ${transactions.length} ta yozuv o'chadi. Buni qaytarib bo'lmaydi.\n\n` +
					(hasWallets
						? "Hamyonlar bilan — fayldagi hamyonlar va ularning qoldiqlari tiklanadi."
						: "Hamyonlar bilan — fayldagi kirimlar hozirgi hamyonlaringizga taqsimlanadi.") +
					"\n\nHamyonlarsiz — hozirgi hamyonlaringiz qoladi, tiklangan yozuvlar ularga tegmaydi va qoldiqlar noldan boshlanadi.",
				[
					{ text: "Bekor qilish", style: "cancel" },
					{
						text: "Hamyonlarsiz",
						style: "destructive",
						onPress: () => restore("skip"),
					},
					{
						text: "Hamyonlar bilan",
						style: "destructive",
						onPress: () => restore("apply"),
					},
				],
			);
		} catch (e) {
			console.warn("[backup] failed to load", e);
			Alert.alert("Tiklanmadi", "Faylni o'qib bo'lmadi.");
		} finally {
			setLoading(false);
		}
	};

	const runTelegramSend = async () => {
		if (telegram.sending) return;
		const result = await telegram.sendNow();
		Alert.alert(
			result.ok ? "Yuborildi" : "Yuborilmadi",
			result.ok ? "Zaxira nusxa Telegramga yuborildi." : result.error,
		);
	};

	const confirmReset = () => {
		Alert.alert(
			"Barcha ma'lumotlar o'chirilsinmi?",
			`${transactions.length} ta yozuv o'chiriladi va boshlang'ich kategoriyalar tiklanadi. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{ text: "O'chirish", style: "destructive", onPress: resetLedger },
			],
		);
	};

	const unit = unitByCode(defaultUnit);

	return (
		<>
			<Stack.Screen options={{ title: "Sozlamalar" }} />
			<View className="flex-1 bg-background">
				<ScrollView
					{...scrollProps}
					className="flex-1 bg-background"
					contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
				>
					{/* Look ---------------------------------------------------------- */}
					<Section title="Ko'rinish" first>
						<View className="gap-3" style={{ padding: 12, paddingLeft: 14 }}>
							<RowHeading
								icon="sunny-outline"
								title="Mavzu"
								subtitle={
									mode === "system"
										? `Tizimga mos — hozir ${THEME_MODE_LABELS[isDark ? "dark" : "light"].toLowerCase()}`
										: undefined
								}
							/>
							<SegmentedControl
								items={THEME_ITEMS}
								value={mode}
								onChange={setMode}
								className="bg-background"
							/>
						</View>
						<View
							className="gap-3 border-t border-border"
							style={{ padding: 12, paddingLeft: 14 }}
						>
							<RowHeading
								icon="text-outline"
								title="Matn o'lchami"
								subtitle="Barcha ekranlarga qo'llanadi"
							/>
							<SegmentedControl
								items={FONT_SCALES.map((s) => ({ key: s, label: FONT_SCALE_LABELS[s] }))}
								value={scale}
								onChange={setScale}
								className="bg-background"
							/>
						</View>
						<Select
							label="Standart valyuta"
							value={defaultUnit}
							toggleOff={false}
							onChange={(next) => next && setDefaultUnit(next)}
							options={UNITS.map((u) => ({ key: u.code, label: `${u.code} — ${u.name}` }))}
							trigger={({ open }) => (
								<ListRow
									title="Valyuta"
									subtitle="Yangi yozuv shu valyuta bilan boshlanadi"
									icon="cash-outline"
									value={`${unit.symbol} (${unit.code})`}
									divider
									onPress={open}
								/>
							)}
						/>
					</Section>

					{/* Distribution --------------------------------------------------- */}
					<Section title="Taqsimot">
						<ListRow
							title="Hamyonlar va ulushlar"
							icon="wallet-outline"
							value={`${wallets.length} ta`}
							onPress={() => router.push("/wallets")}
						/>
						<ListRow
							title="Kirimni avtomatik taqsimlash"
							subtitle="Ulushlar bo'yicha hamyonlarga. O'chirilsa, kirim qaysi hamyonga tushishini o'zingiz tanlaysiz"
							icon="pie-chart-outline"
							divider
							trailing={
								<Toggle
									value={splitIncome}
									onValueChange={setSplitIncome}
									accessibilityLabel="Kirimni avtomatik taqsimlash"
								/>
							}
						/>
						<ListRow
							title="Kontaktlar"
							subtitle={contacts.length ? `${debts.length} ta qarz` : "Qarzdorlarni qo'shing yoki import qiling"}
							icon="people-outline"
							value={contacts.length ? `${contacts.length} ta` : undefined}
							divider
							onPress={() => router.push("/contacts")}
						/>
						<ListRow
							title="Qarzlarni hisobotga qo'shish"
							subtitle="Qarz olish, berish, qaytarish va undirish ham kirim/chiqim jamiga qo'shiladi"
							icon="swap-horizontal-outline"
							divider
							trailing={
								<Toggle
									value={includeDebtsInStats}
									onValueChange={setIncludeDebtsInStats}
									accessibilityLabel="Qarzlarni hisobotga qo'shish"
								/>
							}
						/>
					</Section>

					{/* Privacy ------------------------------------------------------- */}
					<Section title="Maxfiylik">
						<ListRow
							title="Kirimni yashirish"
							subtitle="Kirim, balans va hamyon qoldiqlari nuqtalar bilan ko'rsatiladi"
							icon="eye-off-outline"
							trailing={
								<Toggle
									value={hideIncome}
									onValueChange={toggleHideIncome}
									accessibilityLabel="Kirimni yashirish"
								/>
							}
						/>
					</Section>

					{/* Data ---------------------------------------------------------- */}
					<Section title="Ma'lumotlar">
						<ListRow
							title="Zaxira nusxani ulashish"
							subtitle={`${transactions.length} ta yozuv .db fayl qilib ulashiladi`}
							icon="share-outline"
							onPress={runShare}
							trailing={backup.sharing ? <ActivityIndicator color={tc.foreground} /> : undefined}
						/>
						<ListRow
							title="Fayldan tiklash"
							subtitle=".db zaxira — hozirgi yozuvlar o'rniga qo'yiladi"
							icon="folder-open-outline"
							divider
							onPress={runLoad}
							trailing={loading ? <ActivityIndicator color={tc.foreground} /> : undefined}
						/>
						<ListRow
							title="Telegram zaxira"
							subtitle={
								telegram.configured
									? describeTelegramStatus(telegram.config, telegram.status) +
										(telegram.config.auto ? " · har kuni" : "")
									: "Har kuni Telegram botingizga yuborish"
							}
							icon="cloud-upload-outline"
							divider
							onPress={() => router.push("/telegram")}
						/>
						{telegram.configured && (
							<ListRow
								title="Telegramga hozir yuborish"
								subtitle={`${transactions.length} ta yozuv .db fayl qilib yuboriladi`}
								icon="paper-plane-outline"
								divider
								onPress={runTelegramSend}
								trailing={
									telegram.sending ? <ActivityIndicator color={tc.foreground} /> : undefined
								}
							/>
						)}
						<ListRow
							title="Kiritilgan yozuvlar"
							icon="receipt-outline"
							value={`${transactions.length} ta`}
							divider
						/>
						<ListRow
							title="Ilova versiyasi"
							icon="information-circle-outline"
							value={appVersion}
							divider
						/>
					</Section>

					<Card flush className="mt-5">
						<ListRow
							title="Barcha ma'lumotlarni o'chirish"
							subtitle="Barcha yozuvlar o'chadi, boshlang'ich kategoriyalar tiklanadi"
							icon="trash-outline"
							danger
							onPress={confirmReset}
						/>
					</Card>

					<Text
						className="font-semibold text-muted-foreground text-center px-6 pt-4"
						style={{ fontSize: tf.xs }}
					>
						{telegram.configured
							? "Hammasi shu qurilmada saqlanadi — nusxasi faqat o'zingizning Telegram chatingizga boradi."
							: "Hammasi faqat shu qurilmada saqlanadi."}
					</Text>
				</ScrollView>
				<ScrollShadow visible={scrolled} />
			</View>
		</>
	);
}

/** A group of settings under its small heading. */
function Section({
	title,
	first = false,
	children,
}: {
	title: string;
	first?: boolean;
	children: ReactNode;
}) {
	const { tf } = useFont();
	return (
		<View>
			<Text
				accessibilityRole="header"
				className="font-bold text-muted-foreground ml-1 mb-2"
				style={{ fontSize: tf.sm, marginTop: first ? 4 : 20 }}
			>
				{title}
			</Text>
			<Card flush>{children}</Card>
		</View>
	);
}

/** The label of a setting whose control sits under it rather than beside it. */
function RowHeading({
	icon,
	title,
	subtitle,
}: {
	icon: keyof typeof Ionicons.glyphMap;
	title: string;
	subtitle?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	return (
		<View className="flex-row items-center gap-3">
			<View
				className="items-center justify-center bg-background"
				style={{ width: 32, height: 32, borderRadius: 10 }}
			>
				<Ionicons name={icon} size={18} color={tc.foreground} />
			</View>
			<View className="flex-1 gap-px">
				<Text className="font-semibold text-foreground" style={{ fontSize: tf.base }}>
					{title}
				</Text>
				{!!subtitle && (
					<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1 }}>
						{subtitle}
					</Text>
				)}
			</View>
		</View>
	);
}
