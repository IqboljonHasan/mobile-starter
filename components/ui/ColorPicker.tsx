import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import {
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
}

/**
 * The eight-hue category palette as swatches. The set is deliberately fixed —
 * see lib/categoryColors.ts for why free hex entry isn't offered.
 */
export function ColorPicker({ value, onChange, label }: ColorPickerProps) {
	const { isDark } = useTheme();
	const { tf } = useFont();

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
					return (
						<Pressable
							key={color}
							accessibilityRole="button"
							accessibilityLabel={color}
							accessibilityState={{ selected }}
							onPress={() => onChange(color)}
							hitSlop={4}
							className="items-center justify-center rounded-full active:opacity-70"
							// The selected swatch wears a ring of its own hue with a gap of
							// surface between — legible on the card in either theme, where a
							// checkmark alone would be lost on the lighter hues.
							style={{
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
