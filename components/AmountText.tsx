import { Text, type TextStyle } from "react-native";
import { useTheme } from "@/hooks/useTheme";
import { formatAmount, unitByCode } from "@/lib/money";

/**
 * An amount whose number carries the weight and whose currency sits beside it
 * smaller and dimmer — "936 000 so'm" reads as a number first. The symbol
 * keeps its unit's side ("$12", "12 so'm"), and a masked amount keeps the
 * symbol so hiding income doesn't reflow the row.
 */
export default function AmountText({
	amount,
	unit,
	size,
	mask = false,
	color,
	fit = false,
	style,
}: {
	amount: number;
	unit: string;
	/** Font size of the number; the symbol is drawn at 60% of it. */
	size: number;
	mask?: boolean;
	color?: string;
	/** Shrinks to fit a narrow column instead of truncating. */
	fit?: boolean;
	style?: TextStyle;
}) {
	const { tc } = useTheme();
	const { symbol, position } = unitByCode(unit);
	const number = mask ? "••••" : formatAmount(amount, unit, { showUnit: false });
	const unitText = (
		<Text
			style={{ fontSize: Math.round(size * 0.6), fontWeight: "500", color: tc.mutedForeground }}
		>
			{position === "before" ? symbol : ` ${symbol}`}
		</Text>
	);

	return (
		<Text
			numberOfLines={1}
			adjustsFontSizeToFit={fit}
			style={[
				{ fontSize: size, fontWeight: "700", color: color ?? tc.foreground },
				style,
			]}
		>
			{position === "before" && unitText}
			{number}
			{position === "after" && unitText}
		</Text>
	);
}
