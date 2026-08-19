import { Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import "../../global.css";

export type BadgeTone = "neutral" | "primary" | "success" | "danger" | "warning";

const TONE_CLASSES: Record<BadgeTone, { bg: string; text: string }> = {
	neutral: { bg: "bg-muted", text: "text-muted-foreground" },
	primary: { bg: "bg-primary-highlight", text: "text-primary" },
	success: { bg: "bg-success/15", text: "text-success" },
	danger: { bg: "bg-danger/15", text: "text-danger" },
	warning: { bg: "bg-warning/15", text: "text-warning" },
};

export function Badge({
	label,
	tone = "neutral",
}: {
	label: string;
	tone?: BadgeTone;
}) {
	const { tf } = useFont();
	const classes = TONE_CLASSES[tone];

	return (
		<View className={`self-start rounded-full px-2.5 py-1 ${classes.bg}`}>
			<Text
				className={`font-semibold ${classes.text}`}
				style={{ fontSize: tf.xs }}
			>
				{label}
			</Text>
		</View>
	);
}
