import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { currentYearKey } from "@/lib/date";

/**
 * `MonthSwitcher`'s counterpart for whole years. The forward arrow stops at
 * the current year, for the same reason: nothing is recorded past today.
 */
export default function YearSwitcher({
	value,
	onChange,
}: {
	value: string;
	onChange: (yearKey: string) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const now = currentYearKey();
	const atCurrent = value >= now;

	return (
		<View className="flex-row items-center justify-between">
			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Oldingi yil"
				onPress={() => onChange(String(Number(value) - 1))}
				hitSlop={8}
				className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
			>
				<Ionicons name="chevron-back" size={20} color={tc.foreground} />
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Shu yilga o'tish"
				onPress={() => onChange(now)}
				className="flex-1 items-center active:opacity-60"
			>
				<Text className="font-semibold text-foreground" style={{ fontSize: tf.lg }}>
					{`${value} yil`}
				</Text>
			</Pressable>

			<Pressable
				accessibilityRole="button"
				accessibilityLabel="Keyingi yil"
				disabled={atCurrent}
				onPress={() => onChange(String(Number(value) + 1))}
				hitSlop={8}
				className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
				style={{ opacity: atCurrent ? 0.3 : 1 }}
			>
				<Ionicons name="chevron-forward" size={20} color={tc.foreground} />
			</Pressable>
		</View>
	);
}
