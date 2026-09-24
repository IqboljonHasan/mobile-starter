import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface ListRowProps {
	title: string;
	subtitle?: string;
	/** Ionicons name shown in a tinted circle on the left. */
	icon?: keyof typeof Ionicons.glyphMap;
	/** Overrides the icon circle entirely — e.g. an avatar. */
	leading?: ReactNode;
	/** Right-hand content: a value, a Switch, a Badge. Replaces the chevron. */
	trailing?: ReactNode;
	onPress?: () => void;
	/** Draws a hairline above the row — for stacking rows inside one Card. */
	divider?: boolean;
	danger?: boolean;
}

/**
 * A settings/list line item. Stack several inside a `<Card flush>` with
 * `divider` on every row but the first to get the usual grouped-list look.
 */
export function ListRow({
	title,
	subtitle,
	icon,
	leading,
	trailing,
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
			className={`flex-row items-center gap-3 px-4 py-3.5 ${
				divider ? "border-t border-border" : ""
			}`}
		>
			{leading ??
				(icon && (
					<View
						className={`w-9 h-9 rounded-full items-center justify-center ${
							danger ? "bg-danger/15" : "bg-primary-highlight"
						}`}
					>
						<Ionicons
							name={icon}
							size={18}
							color={danger ? tc.danger : tc.primary}
						/>
					</View>
				))}
			<View className="flex-1">
				<Text
					className={`font-medium ${danger ? "text-danger" : "text-foreground"}`}
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{title}
				</Text>
				{!!subtitle && (
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.sm }}
						numberOfLines={2}
					>
						{subtitle}
					</Text>
				)}
			</View>
			{trailing ??
				(onPress && (
					<Ionicons
						name="chevron-forward"
						size={18}
						color={tc.mutedForeground}
					/>
				))}
		</View>
	);

	if (!onPress) return content;

	return (
		<Pressable
			accessibilityRole="button"
			onPress={handlePress}
			className="active:opacity-70"
		>
			{content}
		</Pressable>
	);
}
