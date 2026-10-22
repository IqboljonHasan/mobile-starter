import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, softTint } from "@/lib/categoryColors";
import type { IconName } from "@/lib/types";

/**
 * A wallet as a small tile: its icon in its own hue on a pastel of that hue.
 * Wallets are the one thing in the app that carries colour, so this is drawn
 * the same wherever a wallet appears — the home tiles, a row's "paid from"
 * badge, the pickers — and a wallet is recognised by it at a glance.
 *
 * The unallocated pool has no icon or palette colour of its own and is drawn
 * neutral, so it can't pass for a wallet that happens to share a hue.
 */
export default function WalletIcon({
	icon,
	color,
	size = 32,
	round = false,
}: {
	/** Null for the unallocated pool. */
	icon: IconName | null;
	/** Palette key from lib/categoryColors.ts. */
	color: string;
	size?: number;
	round?: boolean;
}) {
	const { tc, isDark } = useTheme();
	const neutral = icon === null;
	const hex = neutral ? tc.mutedForeground : categoryColorValue(color, isDark);

	return (
		<View
			className="items-center justify-center"
			style={{
				width: size,
				height: size,
				borderRadius: round ? size / 2 : Math.round(size * 0.32),
				backgroundColor: neutral ? tc.muted : softTint(hex, isDark),
			}}
		>
			<Ionicons
				name={icon ?? "help-circle-outline"}
				size={Math.round(size * 0.52)}
				color={hex}
			/>
		</View>
	);
}
