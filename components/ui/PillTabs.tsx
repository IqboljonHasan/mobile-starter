import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export type PillTab<T extends string = string> = {
	key: T;
	label?: string;
	icon?: keyof typeof Ionicons.glyphMap;
	/** Required when the tab is icon-only — the icon alone says nothing to a screen reader. */
	accessibilityLabel?: string;
};

export interface PillTabsProps<T extends string = string> {
	items: PillTab<T>[];
	value: T;
	onChange: (key: T) => void;
	/**
	 * `surface`: the picked tab is a raised card-colored tile — for switching
	 * what a panel shows. `inverse`: the picked tab is filled with the text
	 * color — a louder mark for the period that scopes the whole screen.
	 */
	variant?: "surface" | "inverse";
	/** Tabs share the full width instead of sizing to their content. */
	fill?: boolean;
	/** Grows to the height of its row, so it lines up with a taller neighbor. */
	stretch?: boolean;
	/** Smaller type and padding, for two groups sharing one row. */
	compact?: boolean;
	className?: string;
}

/**
 * A compact tab group on a muted track. Unlike `SegmentedControl` it can size
 * to its content, so it fits beside a title or in a header.
 */
export function PillTabs<T extends string = string>({
	items,
	value,
	onChange,
	variant = "surface",
	fill = false,
	stretch = false,
	compact = false,
	className,
}: PillTabsProps<T>) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<View
			className={`flex-row rounded-2xl p-1 ${
				stretch ? "self-stretch" : fill ? "" : "self-start"
			} ${className ?? ""}`}
			style={{ backgroundColor: tc.muted }}
		>
			{items.map((item) => {
				const active = item.key === value;
				const fg = active
					? variant === "inverse"
						? tc.background
						: tc.primary
					: tc.mutedForeground;
				return (
					<Pressable
						key={item.key}
						accessibilityRole="button"
						accessibilityLabel={item.accessibilityLabel ?? item.label}
						accessibilityState={{ selected: active }}
						onPress={() => onChange(item.key)}
						className={`flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-70 ${
							fill ? "flex-1" : ""
						} ${item.label ? (compact ? "px-2.5" : "px-3.5") : "px-2.5"}`}
						style={{
							minHeight: 36,
							backgroundColor: active
								? variant === "inverse"
									? tc.foreground
									: tc.card
								: "transparent",
						}}
					>
						{item.icon && <Ionicons name={item.icon} size={compact ? 15 : 18} color={fg} />}
						{!!item.label && (
							<Text
								className="font-semibold"
								style={{ fontSize: compact ? tf.sm : tf.base, color: fg }}
								numberOfLines={1}
							>
								{item.label}
							</Text>
						)}
					</Pressable>
				);
			})}
		</View>
	);
}
