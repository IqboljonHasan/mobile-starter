import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { formatDayLabel } from "@/lib/date";
import type { Transfer, Wallet } from "@/lib/types";
import { walletColor, walletName } from "@/lib/wallets";

/** Transfers listed before the card asks to be expanded. */
const COLLAPSED_ROWS = 5;

/**
 * Every transfer between wallets, newest first — including the ones the
 * expense form records when it covers a shortfall, which otherwise leave no
 * trace beyond two balances that moved.
 *
 * `transfers` arrives scoped to the unit the balances above are showing, so
 * the list always explains the numbers right next to it. Chips narrow it to
 * the transfers one wallet took part in, either side.
 */
export default function TransferHistory({
	transfers,
	wallets,
	money,
	onDelete,
}: {
	transfers: Transfer[];
	wallets: Wallet[];
	/** Formats (or masks) an amount the same way the balances above do. */
	money: (amount: number) => string;
	onDelete: (id: string) => void;
}) {
	const { tf } = useFont();
	const { isDark, tc } = useTheme();
	const [walletFilter, setWalletFilter] = useState<string | null>(null);
	const [expanded, setExpanded] = useState(false);

	const sorted = useMemo(
		() =>
			[...transfers].sort((a, b) =>
				a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
			),
		[transfers],
	);

	// Only wallets that actually appear in a transfer get a chip — one that
	// never moved money would filter down to an empty list.
	const involved = useMemo(() => {
		const ids = new Set(transfers.flatMap((t) => [t.fromWalletId, t.toWalletId]));
		return [...ids].sort((a, b) => {
			const ai = wallets.findIndex((w) => w.id === a);
			const bi = wallets.findIndex((w) => w.id === b);
			// Deleted wallets and the unallocated pool sort after the real ones.
			return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
		});
	}, [transfers, wallets]);
	const filter = walletFilter && involved.includes(walletFilter) ? walletFilter : null;

	const filtered = filter
		? sorted.filter((t) => t.fromWalletId === filter || t.toWalletId === filter)
		: sorted;
	const visible = expanded ? filtered : filtered.slice(0, COLLAPSED_ROWS);

	const hex = (id: string) => categoryColorValue(walletColor(wallets, id), isDark);

	const confirmDelete = (transfer: Transfer) => {
		const from = walletName(wallets, transfer.fromWalletId);
		const to = walletName(wallets, transfer.toWalletId);
		Alert.alert(
			"O'tkazma o'chirilsinmi?",
			`"${from}" dan "${to}" ga o'tkazilgan ${money(transfer.amount)} qaytariladi — ikkala hamyon qoldig'i o'zgaradi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{ text: "O'chirish", style: "destructive", onPress: () => onDelete(transfer.id) },
			],
		);
	};

	if (transfers.length === 0) {
		return (
			<Text className="text-muted-foreground text-center py-4" style={{ fontSize: tf.base }}>
				{"Hali o'tkazma yo'q."}
			</Text>
		);
	}

	return (
		<View>
			{involved.length > 2 && (
				<View className="flex-row flex-wrap gap-2 mb-3">
					{[null, ...involved].map((id) => {
						const active = id === filter;
						return (
							<Pressable
								key={id ?? "all"}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								onPress={() => {
									setWalletFilter(id);
									setExpanded(false);
								}}
								className={`flex-row items-center gap-1.5 px-3 py-1.5 rounded-full active:opacity-70 ${
									active ? "bg-primary-highlight" : "bg-muted"
								}`}
							>
								{id && (
									<View
										style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: hex(id) }}
									/>
								)}
								<Text
									className={`font-semibold ${active ? "text-primary" : "text-muted-foreground"}`}
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
								>
									{id ? walletName(wallets, id) : "Hammasi"}
								</Text>
							</Pressable>
						);
					})}
				</View>
			)}

			<View className="gap-1">
				{visible.map((transfer) => {
					// Seen from the filtered wallet, a transfer is money in or out;
					// with no filter it's neither, just a move.
					const direction =
						filter === transfer.toWalletId ? "in" : filter === transfer.fromWalletId ? "out" : null;
					return (
						<Pressable
							key={transfer.id}
							accessibilityRole="button"
							accessibilityHint="O'chirish uchun bosing"
							onPress={() => confirmDelete(transfer)}
							className="flex-row items-center gap-3 py-2 active:opacity-70"
						>
							<View className="flex-1">
								<View className="flex-row items-center gap-1.5">
									<WalletLabel name={walletName(wallets, transfer.fromWalletId)} color={hex(transfer.fromWalletId)} />
									<Ionicons name="arrow-forward" size={14} color={tc.mutedForeground} />
									<WalletLabel name={walletName(wallets, transfer.toWalletId)} color={hex(transfer.toWalletId)} />
								</View>
								<Text
									className="text-muted-foreground mt-0.5"
									style={{ fontSize: tf.xs }}
									numberOfLines={1}
								>
									{transfer.note
										? `${formatDayLabel(transfer.date)} · ${transfer.note}`
										: formatDayLabel(transfer.date)}
								</Text>
							</View>
							<Text
								className={`font-semibold ${
									direction === "in"
										? "text-success"
										: direction === "out"
											? "text-danger"
											: "text-foreground"
								}`}
								style={{ fontSize: tf.base }}
								numberOfLines={1}
							>
								{`${direction === "in" ? "+" : direction === "out" ? "−" : ""}${money(transfer.amount)}`}
							</Text>
						</Pressable>
					);
				})}
			</View>

			{filtered.length > COLLAPSED_ROWS && (
				<Pressable
					accessibilityRole="button"
					onPress={() => setExpanded((prev) => !prev)}
					className="items-center pt-2 active:opacity-60"
				>
					<Text className="font-semibold text-primary" style={{ fontSize: tf.sm }}>
						{expanded
							? "Kamroq ko'rsatish"
							: `Yana ${filtered.length - COLLAPSED_ROWS} tasini ko'rsatish`}
					</Text>
				</Pressable>
			)}
		</View>
	);
}

function WalletLabel({ name, color }: { name: string; color: string }) {
	const { tf } = useFont();
	return (
		<View className="flex-row items-center gap-1.5 flex-shrink">
			<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
			<Text
				className="font-medium text-foreground flex-shrink"
				style={{ fontSize: tf.base }}
				numberOfLines={1}
			>
				{name}
			</Text>
		</View>
	);
}
