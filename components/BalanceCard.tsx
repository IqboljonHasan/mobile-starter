import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
import AmountText from "@/components/AmountText";
import { Card, PillTabs } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue, withAlpha } from "@/lib/categoryColors";
import { formatAmount } from "@/lib/money";
import { UNALLOCATED_ID, type WalletBalance } from "@/lib/wallets";

/**
 * What the user holds right now: the total, how it divides between the
 * wallets, and each wallet's balance. All-time — a jar's leftover carries
 * forward — so nothing on the month below touches it.
 *
 * The bar is the shape of the money at a glance; the rows under it are the
 * figures, each named and with its own icon, so a wallet is never told apart
 * by color alone. The whole card is the way into the wallets screen.
 */
export default function BalanceCard({
	balances,
	unit,
	units,
	onUnitChange,
	hide,
	onOpen,
}: {
	balances: WalletBalance[];
	unit: string;
	/** Every unit the wallets have held; a chooser appears when there's more than one. */
	units: string[];
	onUnitChange: (unit: string) => void;
	hide: boolean;
	/** Opens the wallets screen — fired by a tap anywhere on the card. */
	onOpen: () => void;
}) {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();

	// Everything held, jars and the unallocated pool alike — a transfer moves
	// money between rows without changing this sum.
	const total = balances.reduce((acc, b) => acc + b.balance, 0);
	// A wallet at or below zero holds no share of anything, so only the ones
	// in credit make up the bar.
	const held = balances.filter((b) => b.balance > 0);

	// The pool has no palette color of its own and is drawn neutral, so it
	// can't pass for a wallet that happens to share its hue.
	const colorOf = (b: WalletBalance) =>
		b.walletId === UNALLOCATED_ID ? tc.mutedForeground : categoryColorValue(b.color, isDark);

	return (
		<Card onPress={onOpen}>
			<View className="flex-row items-center gap-3" style={{ minHeight: 36 }}>
				<Text className="flex-1 font-medium text-muted-foreground" style={{ fontSize: tf.sm }}>
					Jami balans
				</Text>
				{/* Takes its own taps, so switching the unit doesn't also open
				    the wallets screen. */}
				{units.length > 1 && (
					<PillTabs
						compact
						items={units.map((code) => ({ key: code, label: code }))}
						value={unit}
						onChange={onUnitChange}
					/>
				)}
				<Ionicons name="chevron-forward" size={16} color={tc.mutedForeground} />
			</View>
			<AmountText
				amount={total}
				unit={unit}
				size={tf.xxxl + 6}
				mask={hide}
				// Red would give away the sign the mask is hiding.
				color={!hide && total < 0 ? tc.danger : undefined}
				fit
			/>

			{held.length > 0 && (
				<View
					accessibilityElementsHidden
					importantForAccessibility="no-hide-descendants"
					className="flex-row rounded-full overflow-hidden mt-4"
					style={{ height: 8, gap: 2 }}
				>
					{held.map((b) => (
						<View
							key={b.walletId}
							style={{ flexGrow: b.balance, flexBasis: 0, minWidth: 3, backgroundColor: colorOf(b) }}
						/>
					))}
				</View>
			)}

			{balances.length === 0 ? (
				<Text className="text-muted-foreground mt-3" style={{ fontSize: tf.sm }}>
					{"Hali hamyon yo'q."}
				</Text>
			) : (
				<View className="mt-2">
					{balances.map((b) => {
						const color = colorOf(b);
						return (
							<View
								key={b.walletId}
								accessible
								accessibilityLabel={`${b.name}, ${hide ? "yashirilgan" : formatAmount(b.balance, unit)}`}
								className="flex-row items-center gap-3 py-1.5"
							>
								<View
									className="items-center justify-center"
									style={{
										width: 28,
										height: 28,
										borderRadius: 9,
										backgroundColor: withAlpha(color, isDark ? 0.22 : 0.14),
									}}
								>
									<Ionicons name={b.icon ?? "wallet-outline"} size={15} color={color} />
								</View>
								<Text
									className="flex-1 text-foreground"
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{b.name}
								</Text>
								<AmountText
									amount={b.balance}
									unit={unit}
									size={tf.base}
									mask={hide}
									color={!hide && b.balance < 0 ? tc.danger : undefined}
								/>
							</View>
						);
					})}
				</View>
			)}
		</Card>
	);
}
