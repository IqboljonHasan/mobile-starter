import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import {
	CATEGORY_COLOR_LABELS,
	CATEGORY_COLORS,
	type CategoryColor,
	categoryColorValue,
} from "@/lib/categoryColors";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface ColorPickerProps {
	value: CategoryColor;
	onChange: (color: CategoryColor) => void;
	label?: string;
	/** Hues already claimed by a sibling. Shown dimmed and not selectable —
	 *  unless they cover the whole palette, when reuse is the only way forward. */
	takenColors?: CategoryColor[];
}

/**
 * The eight-hue category palette as swatches. The set is deliberately fixed —
 * see lib/categoryColors.ts for why free hex entry isn't offered.
 */
export function ColorPicker({ value, onChange, label, takenColors = [] }: ColorPickerProps) {
	const { isDark } = useTheme();
	const { tf } = useFont();

	const locked = CATEGORY_COLORS.every((c) => takenColors.includes(c)) ? [] : takenColors;

	return (
		<View>
			{!!label && (
				<Text
					className="font-medium text-foreground mb-1.5"
					style={{ fontSize: tf.base }}
				>
					{label}
				</Text>
			)}
			<View className="flex-row flex-wrap gap-3">
				{CATEGORY_COLORS.map((color) => {
					const hex = categoryColorValue(color, isDark);
					const selected = color === value;
					const taken = !selected && locked.includes(color);
					return (
						<Pressable
							key={color}
							accessibilityRole="button"
							accessibilityLabel={CATEGORY_COLOR_LABELS[color]}
							accessibilityState={{ selected, disabled: taken }}
							disabled={taken}
							onPress={() => onChange(color)}
							hitSlop={4}
							className="items-center justify-center rounded-full active:opacity-70"
							// The selected swatch wears a ring of its own hue with a gap of
							// surface between — legible on the card in either theme, where a
							// checkmark alone would be lost on the lighter hues.
							style={{
								opacity: taken ? 0.25 : 1,
								width: 46,
								height: 46,
								borderRadius: 23,
								padding: 3,
								borderWidth: selected ? 2 : 0,
								borderColor: selected ? hex : "transparent",
							}}
						>
							<View
								className="flex-1 self-stretch items-center justify-center"
								style={{ backgroundColor: hex, borderRadius: 18 }}
							>
								{selected && <Ionicons name="checkmark" size={20} color="#fff" />}
							</View>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}
