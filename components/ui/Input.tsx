import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import {
	Pressable,
	Text,
	TextInput,
	type TextInputProps,
	View,
} from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface InputFieldProps
	extends Omit<TextInputProps, "style" | "placeholderTextColor"> {
	label?: string;
	required?: boolean;
	/** Message shown under the field. Turns the border red when set. */
	error?: string;
	/** Dimmer message under the field, shown when there's no `error`. */
	hint?: string;
	rightElement?: ReactNode;
	/**
	 * Renders custom content instead of the built-in TextInput — e.g. a masked
	 * input — while still getting the label/card/border/focus-ring chrome. Wire
	 * the given `onFocus`/`onBlur` into the custom input so the focus ring
	 * still responds to it.
	 */
	renderInput?: (helpers: {
		focused: boolean;
		onFocus: NonNullable<TextInputProps["onFocus"]>;
		onBlur: NonNullable<TextInputProps["onBlur"]>;
	}) => ReactNode;
}

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

	const borderColor = error ? tc.danger : focused ? tc.primary : tc.border;

	return (
		<View>
			{!!label && (
				<Text
					className="font-medium text-foreground mb-1.5"
					style={{ fontSize: tf.base }}
				>
					{label}
					{required && <Text className="text-danger"> *</Text>}
				</Text>
			)}
			<View
				className="flex-row items-center rounded-xl px-5"
				style={{
					backgroundColor: tc.card,
					borderWidth: focused || error ? 1.5 : 1,
					borderColor,
					minHeight: 56,
				}}
			>
				{renderInput ? (
					renderInput({ focused, onFocus: handleFocus, onBlur: handleBlur })
				) : (
					<TextInput
						className="flex-1 py-4"
						style={{ color: tc.foreground, fontSize: tf.lg }}
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
					className={error ? "text-danger mt-1.5" : "text-muted-foreground mt-1.5"}
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
					className="pl-2 py-3"
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
