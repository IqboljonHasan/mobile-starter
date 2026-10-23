import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, softTint } from "@/lib/categoryColors";
import { TAG_META } from "@/lib/debts";
import type { ContactTag } from "@/lib/types";

/** A contact's tag beside their name — "Do'st", "Qarindosh" — in its own hue. */
export default function TagPill({ tag }: { tag: ContactTag }) {
	const { isDark } = useTheme();
	const { tf } = useFont();
	const meta = TAG_META[tag];
	const hex = categoryColorValue(meta.color, isDark);

	return (
		<View
			className="justify-center"
			style={{ height: 20, paddingHorizontal: 8, borderRadius: 10, backgroundColor: softTint(hex, isDark) }}
		>
			<Text className="font-bold" style={{ fontSize: tf.xs, color: hex }} numberOfLines={1}>
				{meta.label}
			</Text>
		</View>
	);
}
