import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	Switch,
	Text,
	View,
} from "react-native";
import { Badge, Card, ListRow, SegmentedControl, Select } from "@/components/ui";
import {
	FONT_SCALE_LABELS,
	FONT_SCALE_VALUES,
	type FontSizeScale,
	useFontSize,
} from "@/contexts/FontSizeContext";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { THEME_MODE_LABELS, type ThemeMode } from "@/contexts/ThemeContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { loadBackup, saveBackup } from "@/lib/backupFile";
import { UNITS, unitByCode } from "@/lib/money";
import "../global.css";

const FONT_SCALES = Object.keys(FONT_SCALE_VALUES) as FontSizeScale[];

const THEME_ITEMS: {
	key: ThemeMode;
	label: string;
	icon: keyof typeof Ionicons.glyphMap;
}[] = [
	{ key: "light", label: THEME_MODE_LABELS.light, icon: "sunny-outline" },
	{ key: "dark", label: THEME_MODE_LABELS.dark, icon: "moon-outline" },
	{
		key: "system",
		label: THEME_MODE_LABELS.system,
		icon: "phone-portrait-outline",
	},
];

export default function SettingsScreen() {
	const router = useRouter();
	const { tc, isDark, mode, setMode } = useTheme();
	const { tf } = useFont();
	const { scale, setScale } = useFontSize();
	const { includeDebtsInStats, setIncludeDebtsInStats } = usePreferences();
	const {
		categories,
		transactions,
		wallets,
		transfers,
		contacts,
		debts,
		defaultUnit,
		setDefaultUnit,
		resetLedger,
		replaceLedger,
	} = useLedger();

	// Both rows open a system picker, which leaves the app in the background for
	// as long as the user browses. Tracking which one is in flight keeps a second
	// picker from being opened on top of the first.
	const [busy, setBusy] = useState<"save" | "load" | null>(null);

	const appVersion = Constants.expoConfig?.version ?? "0.1.0";

	const runSave = async () => {
		if (busy) return;
		setBusy("save");
		try {
			const result = await saveBackup({
				categories,
				transactions,
				wallets,
				transfers,
				contacts,
				debts,
				defaultUnit,
			});
			// A cancelled picker is a decision, not a failure — say nothing.
			if (result.status === "saved") {
				Alert.alert("Saqlandi", `Zaxira nusxa "${result.fileName}" fayliga yozildi.`);
			}
		} catch (e) {
			console.warn("[backup] failed to save", e);
			Alert.alert(
				"Saqlanmadi",
				"Zaxira nusxani yozib bo'lmadi. Boshqa papkani tanlab ko'ring.",
			);
		} finally {
			setBusy(null);
		}
	};

	const runLoad = async () => {
		if (busy) return;
		setBusy("load");
		try {
			const result = await loadBackup();
			if (result.status === "canceled") return;
			if (result.status === "invalid") {
				Alert.alert("Tiklanmadi", result.error);
				return;
			}

			const { payload, skipped } = result;
			Alert.alert(
				"Zaxiradan tiklansinmi?",
				`Fayldan ${payload.transactions.length} ta yozuv va ${payload.categories.length} ta kategoriya tiklanadi.` +
					(skipped > 0 ? ` ${skipped} ta buzuq yozuv o'tkazib yuborildi.` : "") +
					` Hozirgi ${transactions.length} ta yozuv o'chadi. Buni qaytarib bo'lmaydi.`,
				[
					{ text: "Bekor qilish", style: "cancel" },
					{
						text: "Tiklash",
						style: "destructive",
						onPress: () => replaceLedger(payload),
					},
				],
			);
		} catch (e) {
			console.warn("[backup] failed to load", e);
			Alert.alert("Tiklanmadi", "Faylni o'qib bo'lmadi.");
		} finally {
			setBusy(null);
		}
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

	return (
		<>
			<Stack.Screen options={{ title: "Sozlamalar" }} />
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Ledger ------------------------------------------------------ */}
				<Card flush title="Hisob-kitob">
					<ListRow
						title="Kategoriyalar"
						subtitle={`${categories.length} ta kategoriya · ${categories.reduce(
							(n, c) => n + c.subcategories.length,
							0,
						)} ta ichki kategoriya`}
						icon="pricetags-outline"
						onPress={() => router.push("/categories")}
					/>
					<ListRow
						title="Hamyonlar"
						subtitle={`${wallets.length} ta hamyon · kirim ${wallets.reduce(
							(n, w) => n + w.percent,
							0,
						)}% taqsimlanadi`}
						icon="wallet-outline"
						divider
						onPress={() => router.push("/wallets")}
					/>
					<ListRow
						title="Kontaktlar"
						subtitle={
							contacts.length
								? `${contacts.length} ta kontakt · ${debts.length} ta qarz`
								: "Qarzdorlarni qo'shing yoki telefondan import qiling"
						}
						icon="people-outline"
						divider
						onPress={() => router.push("/contacts")}
					/>
					<View className="px-4 py-3.5 border-t border-border">
						<View className="flex-row items-center gap-3 mb-2">
							<View className="w-9 h-9 rounded-full items-center justify-center bg-primary-highlight">
								<Ionicons name="cash-outline" size={18} color={tc.primary} />
							</View>
							<View className="flex-1">
								<Text
									className="font-medium text-foreground"
									style={{ fontSize: tf.base }}
								>
									Standart valyuta
								</Text>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									{"Yangi yozuv shu valyuta bilan boshlanadi — har bir yozuv o'zinikini saqlaydi"}
								</Text>
							</View>
						</View>
						<Select
							label="Standart valyuta"
							value={defaultUnit}
							toggleOff={false}
							onChange={(unit) => unit && setDefaultUnit(unit)}
							options={UNITS.map((u) => ({
								key: u.code,
								label: `${u.code} — ${u.name}`,
							}))}
							trigger={({ open }) => (
								<Pressable
									accessibilityRole="button"
									onPress={open}
									className="flex-row items-center justify-between rounded-xl px-4 py-3 bg-muted active:opacity-70"
								>
									<Text
										className="font-semibold text-foreground"
										style={{ fontSize: tf.base }}
									>
										{defaultUnit} — {unitByCode(defaultUnit).name}
									</Text>
									<Ionicons
										name="chevron-down"
										size={16}
										color={tc.mutedForeground}
									/>
								</Pressable>
							)}
						/>
					</View>
				</Card>

				{/* Stats --------------------------------------------------------- */}
				<Card flush title="Statistika">
					<ListRow
						title="Qarzlarni statistikaga qo'shish"
						subtitle="Qarz olish, qarz berish, qaytarish va undirish — yoqilsa, bular ham kirim/chiqim jamiga qo'shiladi"
						icon="swap-horizontal-outline"
						trailing={
							<Switch
								value={includeDebtsInStats}
								onValueChange={setIncludeDebtsInStats}
								trackColor={{ false: tc.muted, true: tc.primary }}
								thumbColor="#fff"
							/>
						}
					/>
				</Card>

				{/* Backup ------------------------------------------------------ */}
				<Card flush title="Zaxira nusxa">
					<ListRow
						title="Faylga saqlash"
						subtitle={`${transactions.length} ta yozuv va ${categories.length} ta kategoriya JSON fayliga yoziladi`}
						icon="save-outline"
						onPress={runSave}
						trailing={
							busy === "save" ? <ActivityIndicator color={tc.primary} /> : undefined
						}
					/>
					<ListRow
						title="Fayldan tiklash"
						subtitle="Zaxira faylini tanlang — hozirgi yozuvlar o'rniga qo'yiladi"
						icon="folder-open-outline"
						divider
						onPress={runLoad}
						trailing={
							busy === "load" ? <ActivityIndicator color={tc.primary} /> : undefined
						}
					/>
				</Card>

				{/* Theme ------------------------------------------------------- */}
				<Card
					title="Mavzu"
					subtitle={
						mode === "system"
							? `Tizimga mos — hozir ${THEME_MODE_LABELS[isDark ? "dark" : "light"].toLowerCase()}`
							: `Doim ${THEME_MODE_LABELS[mode].toLowerCase()}`
					}
				>
					<SegmentedControl
						items={THEME_ITEMS}
						value={mode}
						onChange={setMode}
						className="bg-muted"
					/>
				</Card>

				{/* Font size --------------------------------------------------- */}
				<Card
					title="Matn o'lchami"
					subtitle={`Hozir: ${FONT_SCALE_LABELS[scale].toLowerCase()} — barcha ekranlarga qo'llanadi`}
				>
					<View className="flex-row gap-2">
						{FONT_SCALES.map((s) => {
							const active = scale === s;
							return (
								<Pressable
									key={s}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
									onPress={() => setScale(s)}
									className={`flex-1 h-11 rounded-full items-center justify-center ${
										active ? "bg-primary" : "bg-muted"
									}`}
								>
									{/* Each option previews its own scale, so the choice is
									    legible before it's applied. */}
									<Text
										style={{
											fontSize: Math.round(13 * FONT_SCALE_VALUES[s]),
											fontWeight: active ? "700" : "500",
											color: active ? "#fff" : tc.mutedForeground,
										}}
									>
										{FONT_SCALE_LABELS[s]}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</Card>

				{/* About ------------------------------------------------------- */}
				<Card flush title="Ilova haqida">
					<ListRow
						title="Versiya"
						icon="information-circle-outline"
						trailing={<Badge label={appVersion} />}
					/>
					<ListRow
						title="Kiritilgan yozuvlar"
						icon="receipt-outline"
						divider
						trailing={<Badge label={String(transactions.length)} tone="primary" />}
					/>
					<ListRow
						title="Barcha ma'lumotlarni o'chirish"
						subtitle="Barcha yozuvlarni o'chirish va boshlang'ich kategoriyalarni tiklash"
						icon="trash-outline"
						danger
						divider
						onPress={confirmReset}
					/>
				</Card>

				<Text
					className="text-muted-foreground text-center px-6 pt-1"
					style={{ fontSize: tf.xs }}
				>
					Hammasi faqat shu qurilmada saqlanadi.
				</Text>
			</ScrollView>
		</>
	);
}
