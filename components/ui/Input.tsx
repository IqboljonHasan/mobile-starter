import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { Pressable, type TextInputProps, View } from "react-native";
import { FieldLabel } from "@/components/ui/FieldLabel";
import { Text, TextInput } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface InputFieldProps
	extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
	label?: string;
	required?: boolean;
	/** Message shown under the field. Rings the field red when set. */
	error?: string;
	/** Dimmer message under the field, shown when there's no `error`. */
	hint?: string;
	rightElement?: ReactNode;
	/**
	 * Renders custom content instead of the built-in TextInput — e.g. a masked
	 * input — while still getting the label/field/focus-ring chrome. Wire
	 * the given `onFocus`/`onBlur` into the custom input so the focus ring
	 * still responds to it.
	 */
	renderInput?: (helpers: {
		focused: boolean;
		onFocus: NonNullable<TextInputProps["onFocus"]>;
		onBlur: NonNullable<TextInputProps["onBlur"]>;
	}) => ReactNode;
}

/**
 * A text field: a borderless grey panel with 16px corners. The ring that
 * appears around it on focus (or red, on an error) is drawn with a border that
 * is always there but transparent at rest, so focusing never shifts the text.
 */
export function InputField({
	label,
	required,
	error,
	hint,
	rightElement,
	renderInput,
	onFocus,
	onBlur,
	...props
}: InputFieldProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [focused, setFocused] = useState(false);

	const handleFocus: NonNullable<TextInputProps["onFocus"]> = (e) => {
		setFocused(true);
		onFocus?.(e);
	};
	const handleBlur: NonNullable<TextInputProps["onBlur"]> = (e) => {
		setFocused(false);
		onBlur?.(e);
	};

	const borderColor = error ? tc.danger : focused ? tc.focus : "transparent";

	return (
		<View>
			{!!label && <FieldLabel required={required}>{label}</FieldLabel>}
			<View
				className="flex-row items-center pl-4 pr-1"
				style={{
					backgroundColor: tc.card,
					borderRadius: 16,
					borderWidth: 1.5,
					borderColor,
					minHeight: 52,
				}}
			>
				{renderInput ? (
					renderInput({ focused, onFocus: handleFocus, onBlur: handleBlur })
				) : (
					<TextInput
						className="flex-1 py-3.5 pr-3 font-bold"
						style={{ color: tc.foreground, fontSize: tf.base }}
						placeholderTextColor={tc.placeholder}
						onFocus={handleFocus}
						onBlur={handleBlur}
						{...props}
					/>
				)}
				{rightElement}
			</View>
			{!!(error || hint) && (
				<Text
					className={`font-semibold mt-1.5 ml-1 ${error ? "text-danger" : "text-muted-foreground"}`}
					style={{ fontSize: tf.sm }}
				>
					{error || hint}
				</Text>
			)}
		</View>
	);
}

export type PasswordFieldProps = Omit<
	InputFieldProps,
	"secureTextEntry" | "rightElement"
>;

export function PasswordField({
	autoComplete = "new-password",
	...props
}: PasswordFieldProps) {
	const { tc } = useTheme();
	const [visible, setVisible] = useState(false);

	return (
		<InputField
			{...props}
			autoComplete={autoComplete}
			secureTextEntry={!visible}
			rightElement={
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={visible ? "Parolni yashirish" : "Parolni ko'rsatish"}
					onPress={() => setVisible((v) => !v)}
					hitSlop={8}
					className="w-11 h-11 items-center justify-center"
				>
					<Ionicons
						name={visible ? "eye-off-outline" : "eye-outline"}
						size={22}
						color={tc.mutedForeground}
					/>
				</Pressable>
			}
		/>
	);
}
