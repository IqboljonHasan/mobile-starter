import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, withAlpha } from "@/lib/categoryColors";
import type { IconName } from "@/lib/types";

/**
 * A category's icon in a circle tinted with its own color — the one place that
 * turns a stored palette key into pixels, so every screen shows a category the
 * same way.
 */
export default function CategoryAvatar({
	icon,
	color,
	size = 40,
}: {
	icon: IconName;
	/** Palette key from lib/categoryColors.ts. */
	color: string;
	size?: number;
}) {
	const { isDark } = useTheme();
	const hex = categoryColorValue(color, isDark);

	return (
		<View
			className="items-center justify-center"
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				// A tint of the hue rather than the hue itself: at icon size a full
				// -strength fill fights the text next to it for attention.
				backgroundColor: withAlpha(hex, isDark ? 0.22 : 0.14),
			}}
		>
			<Ionicons name={icon} size={Math.round(size * 0.5)} color={hex} />
		</View>
	);
}
