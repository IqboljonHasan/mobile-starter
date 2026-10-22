import { useState } from "react";
import { type TextInputProps, View } from "react-native";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { TextInput } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const PADDING_Y = 14;

export interface TextareaProps
	extends Omit<
		TextInputProps,
		| "style"
		| "placeholderTextColor"
		| "multiline"
		| "textAlignVertical"
		| "numberOfLines"
	> {
	label?: string;
	required?: boolean;
	/**
	 * Visible lines at rest. The field is sized from this rather than from
	 * `numberOfLines`, which only affects height on Android and leaves iOS a
	 * single line tall.
	 */
	rows?: number;
}

/**
 * Multi-line counterpart to `<InputField />`, sharing its panel/focus-ring
 * chrome so the two line up in a form.
 */
export function Textarea({
	label,
	required,
	rows = 3,
	onFocus,
	onBlur,
	...props
}: TextareaProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [focused, setFocused] = useState(false);

	// Derived from the scaled font size so the box still fits `rows` lines at
	// every text-size setting.
	const fontSize = tf.base;
	const lineHeight = Math.round(fontSize * 1.45);

	const handleFocus: NonNullable<TextInputProps["onFocus"]> = (e) => {
		setFocused(true);
		onFocus?.(e);
	};
	const handleBlur: NonNullable<TextInputProps["onBlur"]> = (e) => {
		setFocused(false);
		onBlur?.(e);
	};

	return (
		<View>
			{!!label && <FieldLabel required={required}>{label}</FieldLabel>}
			<View
				className="px-4"
				style={{
					backgroundColor: tc.card,
					borderRadius: 18,
					borderWidth: 1.5,
					borderColor: focused ? tc.focus : "transparent",
				}}
			>
				<TextInput
					multiline
					// Without this the text starts vertically centred on Android.
					textAlignVertical="top"
					className="font-semibold"
					style={{
						color: tc.foreground,
						fontSize,
						lineHeight,
						paddingTop: PADDING_Y,
						paddingBottom: PADDING_Y,
						// Grows with content up to `rows`, then scrolls.
						minHeight: rows * lineHeight + PADDING_Y * 2,
					}}
					placeholderTextColor={tc.placeholder}
					onFocus={handleFocus}
					onBlur={handleBlur}
					{...props}
				/>
			</View>
		</View>
	);
}
