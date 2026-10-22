import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import WalletIcon from "@/components/WalletIcon";
import { FieldLabel, PickerField, Select } from "@/components/ui";
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
			<FieldLabel>{label}</FieldLabel>
			<Select
				label={label}
				value={value ?? (allowNone ? NONE_KEY : null)}
				toggleOff={false}
				onChange={(next) => onChange(!next || next === NONE_KEY ? null : next)}
				options={options}
				emptyMessage="Hali hamyon yo'q — avval qo'shing."
				renderOption={(option, selected) => {
					const none = option.key === NONE_KEY;
					const row = rows.find((r) => r.key === option.key);
					return (
						<View className="flex-row items-center gap-3 py-2.5">
							{none ? (
								<View
									className="items-center justify-center bg-muted"
									style={{ width: 34, height: 34, borderRadius: 11 }}
								>
									<Ionicons name="remove" size={18} color={tc.mutedForeground} />
								</View>
							) : (
								<WalletIcon
									icon={option.key === UNALLOCATED_ID ? null : (row?.icon ?? "wallet-outline")}
									color={row?.color ?? "blue"}
									size={34}
								/>
							)}
							<View className="flex-1">
								<Text
									className={`text-foreground ${selected ? "font-extrabold" : "font-semibold"}`}
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{option.label}
								</Text>
								{!none && (
									<Text
										className={`font-semibold ${balanceOf(option.key) < 0 ? "text-danger" : "text-muted-foreground"}`}
										style={{ fontSize: tf.sm }}
										numberOfLines={1}
									>
										{balanceText(option.key)}
									</Text>
								)}
							</View>
							{selected && <Ionicons name="checkmark-circle" size={22} color={tc.foreground} />}
						</View>
					);
				}}
				trigger={({ open }) => (
					<PickerField
						accessibilityLabel={`${label}: ${selectedRow?.name ?? noneLabel}`}
						text={selectedRow?.name ?? null}
						placeholder={noneLabel}
						onPress={open}
						error={!!error}
						leading={
							selectedRow ? (
								<WalletIcon
									icon={selectedRow.key === UNALLOCATED_ID ? null : selectedRow.icon}
									color={selectedRow.color}
									size={32}
								/>
							) : (
								<View
									className="items-center justify-center bg-background"
									style={{ width: 32, height: 32, borderRadius: 10 }}
								>
									<Ionicons name="wallet-outline" size={17} color={tc.mutedForeground} />
								</View>
							)
						}
						detail={
							selectedRow
								? { text: balanceText(selectedRow.key), danger: balanceOf(selectedRow.key) < 0 }
								: null
						}
					/>
				)}
			/>
			{!!error && (
				<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
					{error}
				</Text>
			)}
		</View>
	);
}
