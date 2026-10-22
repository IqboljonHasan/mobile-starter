import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface ListRowProps {
	title: string;
	subtitle?: string;
	/** Ionicons name shown in a small white tile on the left. */
	icon?: keyof typeof Ionicons.glyphMap;
	/** Overrides the icon tile entirely — e.g. an avatar. */
	leading?: ReactNode;
	/** Right-hand content: a Toggle, a Badge. Replaces the chevron. */
	trailing?: ReactNode;
	/** A short value shown before the chevron — "5 ta", "so'm (UZS)". */
	value?: string;
	onPress?: () => void;
	/** Draws a hairline above the row — for stacking rows inside one Card. */
	divider?: boolean;
	danger?: boolean;
}

/**
 * A settings/list line item. Stack several inside a `<Card flush>` with
 * `divider` on every row but the first to get the grouped-list look.
 */
export function ListRow({
	title,
	subtitle,
	icon,
	leading,
	trailing,
	value,
	onPress,
	divider,
	danger,
}: ListRowProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	// Called unconditionally, ahead of the `!onPress` early return below, to
	// keep the hook call itself unconditional — the guard is simply unused
	// when there's nothing to guard.
	const handlePress = useGuardedPress(onPress);

	const content = (
		<View
			className={`flex-row items-center gap-3 pl-3.5 pr-3 py-2.5 ${
				divider ? "border-t border-border" : ""
			}`}
			style={{ minHeight: 56 }}
		>
			{leading ??
				(icon && (
					<View
						className={`items-center justify-center ${danger ? "bg-danger-soft" : "bg-background"}`}
						style={{ width: 32, height: 32, borderRadius: 10 }}
					>
						<Ionicons name={icon} size={18} color={danger ? tc.danger : tc.foreground} />
					</View>
				))}
			<View className="flex-1 gap-px">
				<Text
					className={`font-semibold ${danger ? "text-danger" : "text-foreground"}`}
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{title}
				</Text>
				{!!subtitle && (
					<Text
						className="font-semibold text-muted-foreground"
						style={{ fontSize: tf.sm - 1 }}
						numberOfLines={2}
					>
						{subtitle}
					</Text>
				)}
			</View>
			{!!value && (
				<Text
					className="font-semibold text-muted-foreground"
					style={{ fontSize: tf.sm + 1, maxWidth: "45%" }}
					numberOfLines={1}
				>
					{value}
				</Text>
			)}
			{trailing ??
				(onPress && (
					<Ionicons name="chevron-forward" size={18} color={tc.mutedForeground} />
				))}
		</View>
	);

	if (!onPress) return content;

	return (
		<Pressable accessibilityRole="button" onPress={handlePress} className="active:opacity-70">
			{content}
		</Pressable>
	);
}
