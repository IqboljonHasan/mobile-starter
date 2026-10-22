import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";

/**
 * A total that is also a filter — "Kirim 12 400 000", "Berilgan 1 500 000".
 * Tapping it narrows the list below to that side; tapping again lets go. When
 * on it takes its tone's soft tint and a tick in the corner, so the state
 * never rests on the tint alone.
 */
export default function FilterTile({
	label,
	text,
	tone,
	arrow,
	active,
	onPress,
	accessibilityLabel,
}: {
	label: string;
	/** The figure, already formatted (or masked). */
	text: string;
	tone: "success" | "danger";
	/** Which way the little arrow beside the label points. */
	arrow: "down" | "up" | "up-right" | "down-left";
	active: boolean;
	onPress: () => void;
	accessibilityLabel: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const color = tone === "success" ? tc.success : tc.danger;
	const soft = tone === "success" ? tc.successSoft : tc.dangerSoft;
	const diagonal = arrow === "up-right" || arrow === "down-left";

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${accessibilityLabel}, ${text}`}
			accessibilityState={{ selected: active }}
			onPress={onPress}
			className="flex-1 active:opacity-70"
			style={{
				height: 68,
				borderRadius: 20,
				paddingVertical: 12,
				paddingHorizontal: 14,
				gap: 3,
				backgroundColor: active ? soft : tc.card,
			}}
		>
			<View className="flex-row items-center gap-1.5">
				<Ionicons
					name={arrow === "down" || arrow === "down-left" ? "arrow-down" : "arrow-up"}
					size={13}
					color={color}
					style={diagonal ? { transform: [{ rotate: "45deg" }] } : undefined}
				/>
				<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.xs + 1 }}>
					{label}
				</Text>
			</View>
			<Text
				className="font-extrabold text-foreground"
				style={{ fontSize: tf.xl + 1, letterSpacing: -0.2, paddingRight: active ? 22 : 0 }}
				numberOfLines={1}
				adjustsFontSizeToFit
			>
				{text}
			</Text>
			{active && (
				<View
					className="absolute items-center justify-center"
					style={{ top: 10, right: 10, width: 22, height: 22, borderRadius: 11, backgroundColor: color }}
				>
					<Ionicons name="checkmark" size={13} color="#fff" />
				</View>
			)}
		</Pressable>
	);
}
