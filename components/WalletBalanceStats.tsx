import { useMemo } from "react";
import { Text, View } from "react-native";
import PieChart from "@/components/PieChart";
import StatRow from "@/components/StatRow";
import { CollapsibleCard } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { OTHER_KEY, type StatSlice, sliceColor } from "@/lib/stats";
import { UNALLOCATED_ID, type WalletBalance } from "@/lib/wallets";

/**
 * How the money on hand divides across the wallets, as a pie with its legend.
 * Balances are all-time, so this ignores the screen's period picker.
 * A wallet at or below zero has no share of anything and is left out.
 */
export default function WalletBalanceStats({
	balances,
	unit,
	hide,
}: {
	balances: WalletBalance[];
	unit: string;
	hide: boolean;
}) {
	const { isDark, tc } = useTheme();
	const { tf } = useFont();

	const slices = useMemo<StatSlice[]>(() => {
		const held = balances
			.filter((b) => b.balance > 0)
			.sort((a, b) => b.balance - a.balance);
		const total = held.reduce((acc, b) => acc + b.balance, 0);
		return held.map((b) => ({
			// The unallocated pool has no palette color of its own; the "other"
			// key draws it neutral so it can't pass for a wallet sharing its hue.
			key: b.walletId === UNALLOCATED_ID ? OTHER_KEY : b.walletId,
			name: b.name,
			context: null,
			color: b.color,
			icon: b.icon,
			amount: b.balance,
			share: b.balance / total,
			count: 0,
		}));
	}, [balances]);

	return (
		<CollapsibleCard title="Hamyonlar" subtitle="Hozirgi qoldiq">
			{slices.length === 0 ? (
				<Text className="text-muted-foreground text-center py-4" style={{ fontSize: tf.sm }}>
					{"Hamyonlarda mablag' yo'q."}
				</Text>
			) : (
				<>
					<View>
						<PieChart slices={slices} unit={unit} hideTotal={hide} />
					</View>
					<View className="gap-3 mt-5">
						{slices.map((slice) => (
							<StatRow
								key={slice.key}
								name={slice.name}
								icon={slice.icon ?? "wallet-outline"}
								color={sliceColor(slice.key, slice.color, isDark, tc.mutedForeground)}
								amount={slice.amount}
								share={slice.share}
								unit={unit}
								mask={hide}
								bar={false}
							/>
						))}
					</View>
				</>
			)}
		</CollapsibleCard>
	);
}
