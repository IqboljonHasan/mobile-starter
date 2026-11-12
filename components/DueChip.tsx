import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { dueInfo } from "@/lib/debts";

/**
 * When a debt is due, as a pill: red once it's past, amber within a week,
 * quiet further out. The words always carry the state too — "Muddati o'tgan",
 * "4 kun qoldi" — so the colour is never the only signal.
 */
export default function DueChip({ dueDate, today }: { dueDate: string; today: string }) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { text, tone } = dueInfo(dueDate, today);
	const color = tone === "danger" ? tc.danger : tone === "warning" ? tc.warning : tc.secondaryForeground;
	const background = tone === "danger" ? tc.dangerSoft : tone === "warning" ? tc.warningSoft : tc.muted;

	return (
		<View
			className="flex-row items-center self-start"
			style={{ gap: 6, minHeight: 30, paddingHorizontal: 12, borderRadius: 15, backgroundColor: background }}
		>
			<Ionicons name={tone === "danger" ? "alert-circle-outline" : "time-outline"} size={15} color={color} />
			<Text className="font-extrabold shrink" style={{ fontSize: tf.sm - 1.5, color }}>
				{text}
			</Text>
		</View>
	);
}
