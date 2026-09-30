import { useMemo } from "react";
import { Text, View } from "react-native";
import PieChart from "@/components/PieChart";
import { Card } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { formatAmount, maskAmount } from "@/lib/money";
import { OTHER_KEY, type StatSlice, sliceColor } from "@/lib/stats";
import { UNALLOCATED_ID, type WalletBalance } from "@/lib/wallets";

/**
 * How the money on hand divides across the wallets, as a pie with its legend.
 * Balances are all-time, so this ignores the screen's month or year pickers.
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
			amount: b.balance,
			share: b.balance / total,
			count: 0,
		}));
	}, [balances]);

	return (
		<Card title="Hamyonlar qoldig'i" subtitle="Hozirgi holat bo'yicha">
			{slices.length === 0 ? (
				<Text className="text-muted-foreground text-center py-4" style={{ fontSize: tf.sm }}>
					Hamyonlarda mablag' yo'q.
				</Text>
			) : (
				<>
					<PieChart slices={slices} unit={unit} hideTotal={hide} />
					<View className="gap-3 mt-5">
						{slices.map((slice) => {
							const percent =
								slice.share < 0.01 ? "<1%" : `${Math.round(slice.share * 100)}%`;
							return (
								<View key={slice.key} className="flex-row items-center gap-2">
									<View
										style={{
											width: 10,
											height: 10,
											borderRadius: 5,
											backgroundColor: sliceColor(
												slice.key,
												slice.color,
												isDark,
												tc.mutedForeground,
											),
										}}
									/>
									<Text
										className="flex-1 font-medium text-foreground"
										style={{ fontSize: tf.base }}
										numberOfLines={1}
									>
										{slice.name}
									</Text>
									<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
										{percent}
									</Text>
									<Text
										className="font-semibold text-foreground"
										style={{ fontSize: tf.base }}
									>
										{hide ? maskAmount(unit) : formatAmount(slice.amount, unit)}
									</Text>
								</View>
							);
						})}
					</View>
				</>
			)}
		</Card>
	);
}
