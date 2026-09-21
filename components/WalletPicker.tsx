import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import { Select } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { formatAmount, maskAmount } from "@/lib/money";
import { UNALLOCATED_ID, UNALLOCATED_NAME, type WalletBalance } from "@/lib/wallets";
import type { Wallet } from "@/lib/types";

const NONE_KEY = "__none__";

/**
 * Picks one wallet, showing what each holds so the choice can be made on the
 * balance rather than on the name alone.
 *
 * The balance is what makes this more than a `Select` over names: choosing
 * where an expense comes from without seeing what is left in each jar is how
 * the shortfall gets discovered at save time instead of at decision time.
 */
export default function WalletPicker({
	label,
	value,
	onChange,
	wallets,
	balances,
	unit,
	excludeWalletId,
	allowNone = false,
	noneLabel = "Hamyonsiz",
	includeUnallocated = false,
	hideAmounts = false,
	error,
}: {
	label: string;
	value: string | null;
	onChange: (walletId: string | null) => void;
	wallets: Wallet[];
	/** Balances in `unit`, shown beside each option. */
	balances: WalletBalance[];
	unit: string;
	/** Left out of the list — the other side of a transfer. */
	excludeWalletId?: string | null;
	/** Offers an explicit "no wallet" row, which clears the selection. */
	allowNone?: boolean;
	noneLabel?: string;
	/** Offers the unallocated pool as a source. */
	includeUnallocated?: boolean;
	hideAmounts?: boolean;
	error?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	const rows = [
		...wallets.map((w) => ({
			key: w.id,
			name: w.name,
			color: w.color,
			icon: w.icon,
		})),
		...(includeUnallocated &&
		balances.some((b) => b.walletId === UNALLOCATED_ID && b.balance !== 0)
			? [
					{
						key: UNALLOCATED_ID,
						name: UNALLOCATED_NAME,
						color: "blue",
						icon: "help-circle-outline" as const,
					},
				]
			: []),
	].filter((row) => row.key !== excludeWalletId);

	const options = [
		...(allowNone ? [{ key: NONE_KEY, label: noneLabel }] : []),
		...rows.map((row) => ({ key: row.key, label: row.name })),
	];

	const balanceOf = (walletId: string) =>
		balances.find((b) => b.walletId === walletId)?.balance ?? 0;

	const balanceText = (walletId: string) =>
		hideAmounts ? maskAmount(unit) : formatAmount(balanceOf(walletId), unit);

	const selectedRow = rows.find((row) => row.key === value) ?? null;

	return (
		<View>
			<Text
				className="font-medium text-foreground mb-1.5"
				style={{ fontSize: tf.base }}
			>
				{label}
			</Text>
			<Select
				label={label}
				value={value ?? (allowNone ? NONE_KEY : null)}
				toggleOff={false}
				onChange={(next) => onChange(!next || next === NONE_KEY ? null : next)}
				options={options}
				emptyMessage="Hali hamyon yo'q — avval qo'shing."
				renderOption={(option, selected) => {
					if (option.key === NONE_KEY) {
						return (
							<View className="flex-row items-center gap-3 py-2.5">
								<View className="w-[34px] h-[34px] rounded-full items-center justify-center bg-muted">
									<Ionicons name="remove" size={18} color={tc.mutedForeground} />
								</View>
								<Text
									className={`flex-1 ${selected ? "font-bold text-primary" : "text-foreground"}`}
									style={{ fontSize: tf.base }}
								>
									{option.label}
								</Text>
								{selected && <Ionicons name="checkmark" size={20} color={tc.primary} />}
							</View>
						);
					}

					const row = rows.find((r) => r.key === option.key);
					const balance = balanceOf(option.key);
					return (
						<View className="flex-row items-center gap-3 py-2.5">
							<CategoryAvatar
								icon={row?.icon ?? "wallet-outline"}
								color={row?.color ?? "blue"}
								size={34}
							/>
							<View className="flex-1">
								<Text
									className={selected ? "font-bold text-primary" : "text-foreground"}
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{option.label}
								</Text>
								<Text
									className={balance < 0 ? "text-danger" : "text-muted-foreground"}
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
								>
									{balanceText(option.key)}
								</Text>
							</View>
							{selected && <Ionicons name="checkmark" size={20} color={tc.primary} />}
						</View>
					);
				}}
				trigger={({ open }) => (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`${label}: ${selectedRow?.name ?? noneLabel}`}
						onPress={open}
						className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-70"
						style={{
							backgroundColor: tc.card,
							borderWidth: error ? 1.5 : 1,
							borderColor: error ? tc.danger : tc.border,
							minHeight: 56,
						}}
					>
						{selectedRow ? (
							<CategoryAvatar
								icon={selectedRow.icon}
								color={selectedRow.color}
								size={34}
							/>
						) : (
							<Ionicons name="wallet-outline" size={20} color={tc.mutedForeground} />
						)}
						<View className="flex-1">
							<Text
								style={{
									fontSize: tf.lg,
									color: selectedRow ? tc.foreground : tc.placeholder,
								}}
								numberOfLines={1}
							>
								{selectedRow?.name ?? noneLabel}
							</Text>
							{!!selectedRow && (
								<Text
									className={
										balanceOf(selectedRow.key) < 0
											? "text-danger"
											: "text-muted-foreground"
									}
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
								>
									{balanceText(selectedRow.key)}
								</Text>
							)}
						</View>
						<Ionicons name="chevron-down" size={16} color={tc.mutedForeground} />
					</Pressable>
				)}
			/>
			{!!error && (
				<Text className="text-danger mt-1.5" style={{ fontSize: tf.sm }}>
					{error}
				</Text>
			)}
		</View>
	);
}
