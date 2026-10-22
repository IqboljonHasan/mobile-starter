import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, withAlpha } from "@/lib/categoryColors";
import type { IconName } from "@/lib/types";

/**
 * A category's icon on a rounded tile — the one place that turns a stored
 * palette key into pixels, so every screen shows a category the same way.
 *
 * `mono` draws it in ink on the muted tone instead of in its own hue: in the
 * ledger's rows colour is reserved for the wallets, and a column of coloured
 * category icons beside them would make the two compete.
 */
export default function CategoryAvatar({
	icon,
	color,
	size = 40,
	mono = false,
}: {
	icon: IconName;
	/** Palette key from lib/categoryColors.ts. */
	color: string;
	size?: number;
	mono?: boolean;
}) {
	const { tc, isDark } = useTheme();
	const hex = categoryColorValue(color, isDark);

	return (
		<View
			className="items-center justify-center"
			style={{
				width: size,
				height: size,
				borderRadius: Math.round(size * 0.35),
				// A tint of the hue rather than the hue itself: at icon size a full
				// -strength fill fights the text next to it for attention.
				backgroundColor: mono ? tc.muted : withAlpha(hex, isDark ? 0.22 : 0.14),
			}}
		>
			<Ionicons name={icon} size={Math.round(size * 0.5)} color={mono ? tc.foreground : hex} />
		</View>
	);
}
