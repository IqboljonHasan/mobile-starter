import { Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	CATEGORY_COLORS,
	categoryColorValue,
	withAlpha,
} from "@/lib/categoryColors";
import { contactColorIndex, contactInitials } from "@/lib/debts";

/**
 * A person as initials in a tinted circle — the counterpart to
 * `CategoryAvatar`, and sized to match it so a debt row and a transaction row
 * line up in a list.
 *
 * The hue comes from the contact's id rather than a stored field: a contact is
 * imported from the phone book, where there is nothing to pick a colour with,
 * and adding one must not repaint everybody else.
 */
export default function ContactAvatar({
	name,
	id,
	size = 40,
}: {
	name: string;
	/** Chooses the hue. Same id, same colour, everywhere. */
	id: string;
	size?: number;
}) {
	const { isDark } = useTheme();
	const { tf } = useFont();
	const color = CATEGORY_COLORS[contactColorIndex(id) % CATEGORY_COLORS.length];
	const hex = categoryColorValue(color, isDark);

	return (
		<View
			className="items-center justify-center"
			style={{
				width: size,
				height: size,
				borderRadius: size / 2,
				backgroundColor: withAlpha(hex, isDark ? 0.22 : 0.14),
			}}
		>
			<Text
				className="font-bold"
				style={{ color: hex, fontSize: Math.round(tf.sm * (size / 40)) }}
			>
				{contactInitials(name)}
			</Text>
		</View>
	);
}
