import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { type ReactNode, useEffect } from "react";
import { BackHandler, Keyboard, Pressable, Text, View } from "react-native";
import Animated, { SlideInDown } from "react-native-reanimated";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { type AmountKey, groupAmountText, pressAmountKey } from "@/lib/money";
import { InputField, type InputFieldProps } from "./Input";
import "../../global.css";

const ROWS: AmountKey[][] = [
	["1", "2", "3"],
	["4", "5", "6"],
	["7", "8", "9"],
	["0", ".", "000"],
];

const KEY_HEIGHT = 52;
const GAP = 8;

export interface NumberPadProps {
	visible: boolean;
	/** The amount text as stored in the form — plain digits, no grouping. */
	value: string;
	onChange: (next: string) => void;
	/** The unit's decimal places. A unit used whole (so'm) disables the "." key. */
	decimals: number;
}

/**
 * The keypad money amounts are typed with, in place of the system keyboard.
 *
 * It docks at the bottom the way the system keyboard would, so render it right
 * after the form's ScrollView — on a screen or inside a sheet. The scroll area
 * gives up the room, and as it shrinks Android scrolls the focused field back
 * into view.
 *
 * It pairs with AmountField: `visible` should simply follow that field's focus.
 * That's also how ✓ closes it — it blurs the field, the same way
 * Keyboard.dismiss() puts the system keyboard away.
 */
export function NumberPad({ visible, value, onChange, decimals }: NumberPadProps) {
	const { tc } = useTheme();
	const { tf } = useFont();

	// With the system keyboard, Android's back button first only puts the
	// keyboard away. Without this it would leave the screen, half-filled form
	// and all.
	useEffect(() => {
		if (!visible) return;
		const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
			Keyboard.dismiss();
			return true;
		});
		return () => subscription.remove();
	}, [visible]);

	if (!visible) return null;

	const press = (key: AmountKey) => {
		Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
		const next = pressAmountKey(value, key, decimals);
		if (next !== value) onChange(next);
	};

	return (
		<Animated.View
			entering={SlideInDown.duration(200)}
			style={{
				borderTopWidth: 1,
				borderTopColor: tc.border,
				padding: 12,
				gap: GAP,
			}}
		>
			{ROWS.map((row) => (
				<View key={row.join()} style={{ flexDirection: "row", gap: GAP }}>
					{row.map((key) => (
						<Key
							key={key}
							accessibilityLabel={key === "." ? "Nuqta" : key}
							disabled={key === "." && decimals === 0}
							onPressIn={() => press(key)}
						>
							<Text
								className="font-semibold text-foreground"
								style={{ fontSize: tf.xxl }}
							>
								{key}
							</Text>
						</Key>
					))}
				</View>
			))}
			<View style={{ flexDirection: "row", gap: GAP }}>
				<Key
					accessibilityLabel="O'chirish"
					accessibilityHint="Bosib tursangiz, hammasi tozalanadi"
					onPressIn={() => press("back")}
					onLongPress={() => press("clear")}
				>
					<Ionicons name="backspace-outline" size={26} color={tc.foreground} />
				</Key>
				<Key accessibilityLabel="Tayyor" primary onPress={Keyboard.dismiss}>
					<Ionicons name="checkmark" size={28} color="#fff" />
				</Key>
			</View>
		</Animated.View>
	);
}

/**
 * Typing keys fire on touch-down, so a quick run of digits never waits on a
 * finger lifting; ✓ uses a full press, so brushing it doesn't close the pad.
 */
function Key({
	children,
	accessibilityLabel,
	accessibilityHint,
	disabled = false,
	primary = false,
	onPressIn,
	onPress,
	onLongPress,
}: {
	children: ReactNode;
	accessibilityLabel: string;
	accessibilityHint?: string;
	disabled?: boolean;
	primary?: boolean;
	onPressIn?: () => void;
	onPress?: () => void;
	onLongPress?: () => void;
}) {
	const { tc } = useTheme();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityHint={accessibilityHint}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPressIn={onPressIn}
			onPress={onPress}
			onLongPress={onLongPress}
			style={({ pressed }) => ({
				flex: 1,
				height: KEY_HEIGHT,
				alignItems: "center",
				justifyContent: "center",
				borderRadius: 12,
				backgroundColor: primary ? tc.primary : pressed ? tc.muted : tc.card,
				borderWidth: primary ? 0 : 1,
				borderColor: tc.border,
				opacity: disabled ? 0.35 : primary && pressed ? 0.8 : 1,
			})}
		>
			{children}
		</Pressable>
	);
}

export type AmountFieldProps = Omit<
	InputFieldProps,
	"value" | "onChangeText" | "keyboardType" | "inputMode" | "renderInput"
> & {
	/** The amount text as stored in the form — shown grouped, "1 500 000". */
	value: string;
};

/**
 * A money amount field, typed with NumberPad rather than the system keyboard.
 *
 * It's still a real TextInput, only one that never raises the keyboard. Real
 * focus is what gives it the focus ring, takes it away when another field is
 * tapped (which closes the pad), and on Android has the scroll view keep it in
 * sight as the pad docks below. Input arrives only through the pad, hence no
 * `onChangeText`: anything typed on a hardware keyboard is put back by the
 * controlled `value`.
 */
export function AmountField({ value, ...props }: AmountFieldProps) {
	return (
		<InputField
			{...props}
			value={groupAmountText(value)}
			showSoftInputOnFocus={false}
			// The pad only ever appends or deletes at the end, so a caret that
			// could be tapped anywhere else would promise an edit it can't make.
			caretHidden
			contextMenuHidden
		/>
	);
}
