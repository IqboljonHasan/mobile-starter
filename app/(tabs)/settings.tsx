import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import TabHeader from "@/components/TabHeader";
import { Badge, Card, ListRow, SegmentedControl } from "@/components/ui";
import {
	FONT_SCALE_LABELS,
	FONT_SCALE_VALUES,
	type FontSizeScale,
	useFontSize,
} from "@/contexts/FontSizeContext";
import { THEME_MODE_LABELS, type ThemeMode } from "@/contexts/ThemeContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const FONT_SCALES = Object.keys(FONT_SCALE_VALUES) as FontSizeScale[];

const THEME_ITEMS: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
	{ key: "light", label: THEME_MODE_LABELS.light, icon: "sunny-outline" },
	{ key: "dark", label: THEME_MODE_LABELS.dark, icon: "moon-outline" },
	{ key: "system", label: THEME_MODE_LABELS.system, icon: "phone-portrait-outline" },
];

export default function SettingsScreen() {
	const { tc, isDark, mode, setMode } = useTheme();
	const { tf } = useFont();
	const { scale, setScale } = useFontSize();
	const shadow = useTabScrollShadow("settings");
	const [haptics, setHaptics] = useState(true);

	const appVersion = Constants.expoConfig?.version ?? "0.1.0";

	return (
		<View className="flex-1 bg-background">
			<TabHeader title="Settings" subtitle="Appearance & preferences" />
			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12 }}
				showsVerticalScrollIndicator={false}
			>
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
					<View className="mt-4 rounded-xl bg-muted p-3">
						<Text
							className="font-semibold text-foreground"
							style={{ fontSize: tf.lg }}
						>
							Preview heading
						</Text>
						<Text
							className="text-muted-foreground mt-1"
							style={{ fontSize: tf.base }}
						>
							Body text at the selected scale. Components read their sizes from
							the `useFont()` hook, so this affects the whole app.
						</Text>
					</View>
				</Card>

				{/* Preferences ------------------------------------------------- */}
				<Card flush title="Preferences">
					<ListRow
						title="Haptic feedback"
						subtitle="Vibrate on tab change"
						icon="pulse-outline"
						trailing={
							<Switch
								value={haptics}
								onValueChange={setHaptics}
								trackColor={{ false: tc.disabled, true: tc.primary }}
								thumbColor="#fff"
							/>
						}
					/>
					<ListRow
						title="Language"
						icon="language-outline"
						divider
						trailing={
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.base }}
							>
								English
							</Text>
						}
						onPress={() => {}}
					/>
				</Card>

				{/* About ------------------------------------------------------- */}
				<Card flush title="About">
					<ListRow
						title="Version"
						icon="information-circle-outline"
						trailing={<Badge label={appVersion} />}
					/>
					<ListRow
						title="Reset preferences"
						subtitle="Back to system theme and normal text"
						icon="refresh-outline"
						danger
						divider
						onPress={() => {
							setMode("system");
							setScale("normal");
						}}
					/>
				</Card>
			</ScrollView>
		</View>
	);
}
