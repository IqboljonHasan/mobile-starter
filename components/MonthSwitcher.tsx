import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentMonthKey, monthTitle, shiftMonth } from "@/lib/date";

/**
 * Moves a screen between calendar months. The forward arrow stops at the
 * current month — there is nothing recorded past today, so an empty future
 * month is only ever a wrong turn.
 */
export default function MonthSwitcher({
	value,
	surface = "muted",
	onChange,
}: {
	value: string;
	/** What the round buttons are filled with — the muted tone on a sheet, a
	 *  translucent tint on the home screen's frosted panel. */
	surface?: "muted" | "glass";
	onChange: (monthKey: string) => void;
}) {
	const { tc, isDark } = useTheme();
	const buttonBg =
		surface === "glass" ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(11,27,46,0.06)") : tc.muted;
	const { tf } = useFont();
	const now = currentMonthKey();
	const atCurrent = value >= now;

	return (
		<View className="flex-row items-center justify-between">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Oldingi oy"
				onPress={() => onChange(shiftMonth(value, -1))}
				className="w-11 h-11 items-center justify-center rounded-full active:opacity-60"
				style={{ backgroundColor: buttonBg }}
			>
				<Ionicons name="chevron-back" size={18} color={tc.foreground} />
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Shu oyga o'tish"
				onPress={() => onChange(now)}
				className="flex-1 items-center active:opacity-60"
			>
				<Text
					className="font-extrabold text-foreground"
					style={{ fontSize: tf.lg, letterSpacing: -0.2 }}
					numberOfLines={1}
					adjustsFontSizeToFit
				>
					{monthTitle(value)}
				</Text>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Keyingi oy"
				disabled={atCurrent}
				onPress={() => onChange(shiftMonth(value, 1))}
				className="w-11 h-11 items-center justify-center rounded-full active:opacity-60"
				style={{ backgroundColor: buttonBg, opacity: atCurrent ? 0.35 : 1 }}
			>
				<Ionicons name="chevron-forward" size={18} color={tc.foreground} />
			</Pressable>
		</View>
	);
}
