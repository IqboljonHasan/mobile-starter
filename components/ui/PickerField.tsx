import { Ionicons } from "@expo/vector-icons";
import { type ReactNode } from "react";
import { Pressable } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

/**
 * The closed state of a picker — a grey field showing what's chosen, with a
 * chevron saying it opens. Used as the trigger of every `Select` in the forms
 * so the category, the wallet and the person all look like the same kind of
 * control.
 */
export function PickerField({
	text,
	placeholder,
	onPress,
	leading,
	detail,
	trailing,
	disabled = false,
	error = false,
	accessibilityLabel,
}: {
	/** What's chosen; the placeholder shows, dimmed, while this is null. */
	text: string | null;
	placeholder: string;
	onPress: () => void;
	/** Drawn before the text — a wallet's tile, a person's initials. */
	leading?: ReactNode;
	/** A short figure after the text — a wallet's balance, say. */
	detail?: { text: string; danger?: boolean } | null;
	/** Replaces the chevron. */
	trailing?: ReactNode;
	disabled?: boolean;
	error?: boolean;
	accessibilityLabel?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? text ?? placeholder}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={onPress}
			className={`flex-row items-center gap-2.5 active:opacity-70 ${disabled ? "opacity-50" : ""}`}
			style={{
				minHeight: 52,
				borderRadius: 16,
				paddingLeft: leading ? 10 : 14,
				paddingRight: 12,
				backgroundColor: tc.card,
				borderWidth: 1.5,
				borderColor: error ? tc.danger : "transparent",
			}}
		>
			{leading}
			<Text
				className="flex-1 font-bold"
				style={{ fontSize: tf.base, color: text ? tc.foreground : tc.placeholder }}
				numberOfLines={1}
			>
				{text ?? placeholder}
			</Text>
			{!!detail && (
				<Text
					className="font-semibold"
					style={{ fontSize: tf.sm, color: detail.danger ? tc.danger : tc.mutedForeground }}
					numberOfLines={1}
				>
					{detail.text}
				</Text>
			)}
			{trailing ?? <Ionicons name="chevron-down" size={18} color={tc.mutedForeground} />}
		</Pressable>
	);
}

