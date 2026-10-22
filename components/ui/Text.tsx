import { forwardRef } from "react";
import {
	Text as RNText,
	TextInput as RNTextInput,
	type TextInputProps,
	type TextProps,
} from "react-native";
import { FONT_FAMILY } from "@/lib/theme";

/**
 * React Native has no app-wide default font, so every `Text` and `TextInput`
 * in the app comes from here instead of from "react-native": the same
 * components with Manrope laid under whatever style they are given.
 *
 * Only the family is set — weight still comes from `font-bold` & co. or a
 * `fontWeight` style, and the natively linked font family (app.json) turns
 * that into the matching Manrope file.
 */
export const Text = forwardRef<RNText, TextProps>(function Text({ style, ...props }, ref) {
	return <RNText ref={ref} {...props} style={[{ fontFamily: FONT_FAMILY }, style]} />;
});

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput(
	{ style, ...props },
	ref,
) {
	return <RNTextInput ref={ref} {...props} style={[{ fontFamily: FONT_FAMILY }, style]} />;
});
