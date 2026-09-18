import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Stack, useRouter } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Badge, Card, ListRow, SegmentedControl, Select } from "@/components/ui";
import {
	FONT_SCALE_LABELS,
	FONT_SCALE_VALUES,
	type FontSizeScale,
	useFontSize,
} from "@/contexts/FontSizeContext";
import { useLedger } from "@/contexts/LedgerContext";
import { THEME_MODE_LABELS, type ThemeMode } from "@/contexts/ThemeContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
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
	const {
		categories,
		transactions,
		defaultUnit,
		setDefaultUnit,
		resetLedger,
	} = useLedger();

	const appVersion = Constants.expoConfig?.version ?? "0.1.0";

	const confirmReset = () => {
		Alert.alert(
			"Erase all data?",
			`${transactions.length} ${
				transactions.length === 1 ? "entry" : "entries"
			} will be deleted and the starter categories restored. This can't be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{ text: "Erase", style: "destructive", onPress: resetLedger },
			],
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Settings" }} />
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Ledger ------------------------------------------------------ */}
				<Card flush title="Ledger">
					<ListRow
						title="Categories"
						subtitle={`${categories.length} categories · ${categories.reduce(
							(n, c) => n + c.subcategories.length,
							0,
						)} subcategories`}
						icon="pricetags-outline"
						onPress={() => router.push("/categories")}
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
									Default unit
								</Text>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									What a new entry starts with — each entry keeps its own
								</Text>
							</View>
						</View>
						<Select
							label="Default unit"
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

				{/* Theme ------------------------------------------------------- */}
				<Card
					title="Theme"
					subtitle={
						mode === "system"
							? `Following the system — currently ${isDark ? "dark" : "light"}`
							: `Always ${mode}`
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
					title="Text size"
					subtitle={`Currently ${FONT_SCALE_LABELS[scale].toLowerCase()} — every screen follows this`}
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
				<Card flush title="About">
					<ListRow
						title="Version"
						icon="information-circle-outline"
						trailing={<Badge label={appVersion} />}
					/>
					<ListRow
						title="Entries recorded"
						icon="receipt-outline"
						divider
						trailing={<Badge label={String(transactions.length)} tone="primary" />}
					/>
					<ListRow
						title="Erase all data"
						subtitle="Delete every entry and restore the starter categories"
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
					Everything is stored on this device only.
				</Text>
			</ScrollView>
		</>
	);
}
