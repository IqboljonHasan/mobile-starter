import { Text } from "@/components/ui/Text";
import { useTheme } from "@/hooks/useTheme";
import { formatAmount, maskAmount, unitByCode } from "@/lib/money";

/**
 * A screen's headline figure — "600 000 so'm" — with a trailing unit set
 * smaller and quieter than the number, so the eye lands on the amount. A unit
 * written before the number ("$600") stays part of it, as it is read.
 */
export default function HeroAmount({
	amount,
	unit,
	size,
	color,
	sign = "",
	masked = false,
}: {
	/** Shown as is — pass the absolute value and put the direction in `sign`. */
	amount: number;
	unit: string;
	/** The number's font size; the unit is set at about half of it. */
	size: number;
	color?: string;
	sign?: "+" | "−" | "";
	/** Hide the figure, as "hide amounts" asks for. */
	masked?: boolean;
}) {
	const { tc } = useTheme();
	const { symbol, position } = unitByCode(unit);
	const trailing = position === "after";
	// The trailing unit is drawn separately below, so it comes off the mask too.
	const body = masked
		? maskAmount(unit).replace(trailing ? ` ${symbol}` : "", "")
		: formatAmount(amount, unit, { showUnit: !trailing });

	return (
		<Text
			className="font-extrabold"
			style={{ fontSize: size, lineHeight: Math.round(size * 1.16), letterSpacing: -0.4, color: color ?? tc.foreground }}
			numberOfLines={1}
			adjustsFontSizeToFit
		>
			{`${sign}${body}`}
			{trailing && (
				<Text className="font-bold" style={{ fontSize: Math.round(size * 0.46), letterSpacing: 0, color: tc.mutedForeground }}>
					{` ${symbol}`}
				</Text>
			)}
		</Text>
	);
}
