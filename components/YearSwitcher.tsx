import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentYearKey } from "@/lib/date";

/**
 * `MonthSwitcher`'s counterpart for whole years. The forward arrow stops at
 * the current year, for the same reason: nothing is recorded past today.
 */
export default function YearSwitcher({
	value,
	surface = "muted",
	onChange,
}: {
	value: string;
	/** What the round buttons are filled with — the muted tone on a sheet, a
	 *  translucent tint on the home screen's frosted panel. */
	surface?: "muted" | "glass";
	onChange: (yearKey: string) => void;
}) {
	const { tc, isDark } = useTheme();
	const buttonBg =
		surface === "glass" ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(11,27,46,0.06)") : tc.muted;
	const { tf } = useFont();
	const now = currentYearKey();
	const atCurrent = value >= now;

	return (
		<View className="flex-row items-center justify-between">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Oldingi yil"
				onPress={() => onChange(String(Number(value) - 1))}
				className="w-11 h-11 items-center justify-center rounded-full active:opacity-60"
				style={{ backgroundColor: buttonBg }}
			>
				<Ionicons name="chevron-back" size={18} color={tc.foreground} />
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Shu yilga o'tish"
				onPress={() => onChange(now)}
				className="flex-1 items-center active:opacity-60"
			>
				<Text
					className="font-extrabold text-foreground"
					style={{ fontSize: tf.lg, letterSpacing: -0.2 }}
					numberOfLines={1}
					adjustsFontSizeToFit
				>
					{`${value} yil`}
				</Text>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Keyingi yil"
				disabled={atCurrent}
				onPress={() => onChange(String(Number(value) + 1))}
				className="w-11 h-11 items-center justify-center rounded-full active:opacity-60"
				style={{ backgroundColor: buttonBg, opacity: atCurrent ? 0.35 : 1 }}
			>
				<Ionicons name="chevron-forward" size={18} color={tc.foreground} />
			</Pressable>
		</View>
	);
}
