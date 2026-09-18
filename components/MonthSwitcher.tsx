import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
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
	onChange,
}: {
	value: string;
	onChange: (monthKey: string) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const now = currentMonthKey();
	const atCurrent = value >= now;

	return (
		<View className="flex-row items-center justify-between">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Previous month"
				onPress={() => onChange(shiftMonth(value, -1))}
				hitSlop={8}
				className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
			>
				<Ionicons name="chevron-back" size={20} color={tc.foreground} />
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Jump to this month"
				onPress={() => onChange(now)}
				className="flex-1 items-center active:opacity-60"
			>
				<Text
					className="font-semibold text-foreground"
					style={{ fontSize: tf.lg }}
				>
					{monthTitle(value)}
				</Text>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Next month"
				disabled={atCurrent}
				onPress={() => onChange(shiftMonth(value, 1))}
				hitSlop={8}
				className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
				style={{ opacity: atCurrent ? 0.3 : 1 }}
			>
				<Ionicons name="chevron-forward" size={20} color={tc.foreground} />
			</Pressable>
		</View>
	);
}
