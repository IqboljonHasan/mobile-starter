import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { categoryColorValue, deepen } from "@/lib/categoryColors";
import type { IconName } from "@/lib/types";

/** A bank card's proportions (85.6 × 54 mm), at a width that leaves the next
 *  card peeking in from the edge of the screen. */
export const WALLET_CARD_W = 156;
export const WALLET_CARD_H = Math.round(WALLET_CARD_W / 1.586);
export const WALLET_CARD_RADIUS = 16;

/** The unallocated pool has no hue of its own; it gets a plain slate card. */
const POOL_HUE = "#5b6b80";

/**
 * A wallet drawn as a plastic card: its hue as a gradient running down to a
 * deep shade, a chip and the wallet's own icon along the top, and along the
 * bottom what it holds with its name where a cardholder's would be — so the
 * row on Home reads at a glance as wallets, not as categories.
 *
 * The card keeps its light-scheme hue in dark mode too: it's an object lying
 * on the sky, not a surface of the screen, and white text is laid on the deep
 * end of the gradient so even the lightest hues stay legible.
 */
export default function WalletCard({
	id,
	name,
	icon,
	color,
	amount,
	negative = false,
	accessibilityLabel,
}: {
	/** Keeps each card's gradient definition its own. */
	id: string;
	name: string;
	/** Null for the unallocated pool. */
	icon: IconName | null;
	/** Palette key from lib/categoryColors.ts. */
	color: string;
	/** Already formatted — or masked. */
	amount: string;
	negative?: boolean;
	accessibilityLabel: string;
}) {
	const { tf } = useFont();
	const hue = icon === null ? POOL_HUE : categoryColorValue(color, false);
	const gradient = `wallet-card-${id}`;

	return (
		<View
			accessible
			accessibilityLabel={accessibilityLabel}
			style={{
				width: WALLET_CARD_W,
				height: WALLET_CARD_H,
				borderRadius: WALLET_CARD_RADIUS,
				overflow: "hidden",
				padding: 12,
				justifyContent: "space-between",
			}}
		>
			<View style={{ position: "absolute", left: 0, top: 0 }}>
				<Svg width={WALLET_CARD_W} height={WALLET_CARD_H}>
					<Defs>
						<LinearGradient id={gradient} x1="0" y1="0" x2="0.45" y2="1">
							<Stop offset="0" stopColor={hue} />
							<Stop offset="1" stopColor={deepen(hue, 0.55)} />
						</LinearGradient>
					</Defs>
					<Rect width={WALLET_CARD_W} height={WALLET_CARD_H} fill={`url(#${gradient})`} />
					{/* The sheen of the plastic: two faint discs off the top corner. */}
					<Circle cx={WALLET_CARD_W - 8} cy={-6} r={46} fill="#fff" fillOpacity={0.1} />
					<Circle cx={WALLET_CARD_W + 18} cy={30} r={42} fill="#fff" fillOpacity={0.07} />
				</Svg>
			</View>

			<View className="flex-row items-center justify-between">
				{/* The chip — what makes it read as a card before anything else does. */}
				<View
					style={{
						width: 24,
						height: 18,
						borderRadius: 4,
						backgroundColor: "#e9c46a",
						borderWidth: 1,
						borderColor: "rgba(120,80,0,0.25)",
						justifyContent: "center",
					}}
				>
					<View style={{ height: 1, backgroundColor: "rgba(120,80,0,0.3)" }} />
				</View>
				{icon !== null && <Ionicons name={icon} size={16} color="rgba(255,255,255,0.92)" />}
			</View>

			<View style={{ gap: 1 }}>
				<Text
					className="font-extrabold"
					style={{ fontSize: tf.base + 1, color: "#fff", letterSpacing: -0.2 }}
					numberOfLines={1}
					adjustsFontSizeToFit
				>
					{amount}
				</Text>
				<View className="flex-row items-center" style={{ gap: 4 }}>
					{negative && <Ionicons name="alert-circle" size={11} color="#fecaca" />}
					<Text
						className="font-bold"
						style={{
							flexShrink: 1,
							fontSize: tf.xs - 1,
							letterSpacing: 1,
							color: "rgba(255,255,255,0.82)",
						}}
						numberOfLines={1}
					>
						{name.toUpperCase()}
					</Text>
				</View>
			</View>
		</View>
	);
}
