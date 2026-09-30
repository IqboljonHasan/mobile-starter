import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { withAlpha } from "@/lib/categoryColors";
import { formatAmount } from "@/lib/money";
import type { IconName } from "@/lib/types";

/**
 * One ranked line of a stats card: a tinted icon tile, the name, the amount,
 * and under them a bar of the row's share with the percentage at its end.
 * With `bar` off it is a single legend line for a pie — the pie already
 * shows the share, so the bar would only repeat it.
 * Every row is directly labelled, so color never carries identity alone.
 */
export default function StatRow({
	name,
	context = null,
	icon,
	color,
	amount,
	share,
	unit,
	mask,
	bar = true,
	showPercent = false,
	active = false,
	onPress,
}: {
	name: string;
	/** A dimmer second line — the parent category of a subcategory, say. */
	context?: string | null;
	icon: IconName;
	/** Resolved hex, not a palette key. */
	color: string;
	amount: number;
	/** 0–1 of the card's total. */
	share: number;
	unit: string;
	mask: boolean;
	bar?: boolean;
	/** Legend form only: adds the share after the amount. */
	showPercent?: boolean;
	active?: boolean;
	onPress?: () => void;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const percent = share < 0.01 ? "<1%" : `${Math.round(share * 100)}%`;
	const avatar = bar ? 44 : 36;

	return (
		<Pressable
			accessibilityRole={onPress ? "button" : "text"}
			accessibilityState={onPress ? { expanded: active } : undefined}
			accessibilityLabel={`${name}${context ? `, ${context}` : ""}, ${
				mask ? "yashirilgan" : formatAmount(amount, unit)
			}, ${percent}`}
			disabled={!onPress}
			onPress={onPress}
			className={`flex-row items-center gap-3.5 ${onPress ? "active:opacity-70" : ""}`}
		>
			<View
				className="items-center justify-center"
				style={{
					width: avatar,
					height: avatar,
					borderRadius: avatar * 0.32,
					backgroundColor: withAlpha(color, isDark ? 0.22 : 0.14),
				}}
			>
				<Ionicons name={icon} size={Math.round(avatar * 0.5)} color={color} />
			</View>

			<View className="flex-1">
				<View className={`flex-row gap-2 ${bar ? "items-baseline" : "items-center"}`}>
					<View className="flex-1">
						<Text
							className={bar ? "font-semibold" : "font-medium"}
							style={{
								fontSize: bar ? tf.lg : tf.base,
								color: active ? tc.primary : tc.foreground,
							}}
							numberOfLines={1}
						>
							{name}
						</Text>
						{!!context && (
							<Text className="text-muted-foreground" style={{ fontSize: tf.xs }} numberOfLines={1}>
								{context}
							</Text>
						)}
					</View>
					<AmountText amount={amount} unit={unit} size={tf.base} mask={mask} />
					{!bar && showPercent && (
						<Text
							className="text-muted-foreground text-right"
							style={{ fontSize: tf.sm, minWidth: 36 }}
						>
							{percent}
						</Text>
					)}
				</View>

				{bar && (
					<View className="flex-row items-center gap-3 mt-2">
						<View
							className="flex-1 rounded-full overflow-hidden"
							style={{ height: 6, backgroundColor: tc.muted }}
						>
							<View
								style={{
									// A zero-width bar reads as a rendering bug; a hairline
									// reads as "almost nothing", which is the truth.
									width: `${Math.max(share * 100, 1.5)}%`,
									height: 6,
									borderRadius: 3,
									backgroundColor: color,
								}}
							/>
						</View>
						<Text
							className="font-semibold text-foreground text-right"
							style={{ fontSize: tf.sm, minWidth: 36 }}
						>
							{percent}
						</Text>
					</View>
				)}
			</View>
		</Pressable>
	);
}
