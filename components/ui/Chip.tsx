import { Ionicons } from "@expo/vector-icons";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

/**
 * A pill that filters or picks — ink when on, muted when off. A chip can carry
 * a colour dot (a wallet, say), which is always paired with its name, so the
 * colour is never the only thing telling two chips apart.
 */
export function Chip({
	label,
	active,
	onPress,
	onLongPress,
	dot,
	leadingIcon,
	icon,
	size = "md",
	surface = "muted",
	role = "button",
	accessibilityLabel,
}: {
	label: string;
	active: boolean;
	onPress: () => void;
	onLongPress?: () => void;
	/** A colour dot before the label. */
	dot?: string;
	/** An icon before the label — what kind of pick this is. */
	leadingIcon?: keyof typeof Ionicons.glyphMap;
	/** An icon after the label — e.g. a close mark on a removable filter. */
	icon?: keyof typeof Ionicons.glyphMap;
	/** `md` is a 40px filter chip, `sm` a 32px quick pick. */
	size?: "sm" | "md";
	/** What an inactive chip is filled with: `muted` on the sheet, `background`
	 *  (white) when the chip sits on a grey group. */
	surface?: "muted" | "background";
	role?: "button" | "radio";
	accessibilityLabel?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const height = size === "md" ? 40 : 32;

	return (
		<Pressable
			accessibilityRole={role}
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={role === "radio" ? { checked: active } : { selected: active }}
			onPress={onPress}
			onLongPress={onLongPress}
			className={`flex-row items-center active:opacity-70 ${
				active ? "bg-primary" : surface === "muted" ? "bg-muted" : "bg-background"
			}`}
			style={{
				height,
				borderRadius: height / 2,
				paddingHorizontal: size === "md" ? 16 : 12,
				gap: size === "md" ? 8 : 6,
			}}
		>
			{!!dot && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />}
			{!!leadingIcon && (
				<Ionicons name={leadingIcon} size={14} color={active ? tc.primaryFg : tc.foreground} />
			)}
			<Text
				className={`font-bold ${active ? "text-primary-fg" : "text-foreground"}`}
				style={{ fontSize: size === "md" ? tf.sm + 1 : tf.sm }}
				numberOfLines={1}
			>
				{label}
			</Text>
			{!!icon && (
				<Ionicons name={icon} size={15} color={active ? tc.primaryFg : tc.mutedForeground} />
			)}
		</Pressable>
	);
}
