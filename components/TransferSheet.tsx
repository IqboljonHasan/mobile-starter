import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import WalletPicker from "@/components/WalletPicker";
import { BottomSheet, Button, InputField } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { todayISO } from "@/lib/date";
import { formatAmount, parseAmount } from "@/lib/money";
import type { TransferInput, Wallet } from "@/lib/types";
import type { WalletBalance } from "@/lib/wallets";

/**
 * Moves money from one wallet to another.
 *
 * This is the escape valve the method needs: an expense is blocked when its
 * wallet is short, and the honest way through is to say which other jar is
 * paying for it. Without this, a blocked expense would have no resolution but
 * to abandon the record of money that was actually spent.
 */
export default function TransferSheet({
	visible,
	onClose,
	onSubmit,
	wallets,
	balances,
	unit,
	title = "Hamyonlar orasida o'tkazish",
	description,
	initialToWalletId = null,
	initialFromWalletId = null,
	initialAmount,
	submitLabel = "O'tkazish",
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (input: TransferInput) => void;
	wallets: Wallet[];
	balances: WalletBalance[];
	unit: string;
	title?: string;
	description?: string;
	initialToWalletId?: string | null;
	initialFromWalletId?: string | null;
	/** Pre-fills the amount — the shortfall being covered. */
	initialAmount?: number;
	submitLabel?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	const [fromWalletId, setFromWalletId] = useState<string | null>(initialFromWalletId);
	const [toWalletId, setToWalletId] = useState<string | null>(initialToWalletId);
	const [amountText, setAmountText] = useState(
		initialAmount ? String(initialAmount) : "",
	);
	const [note, setNote] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const amount = parseAmount(amountText);
	const amountError = !amountText.trim()
		? "Summani kiriting"
		: !Number.isFinite(amount) || amount <= 0
			? "Summa noldan katta bo'lishi kerak"
			: undefined;
	const fromError = fromWalletId ? undefined : "Qaysi hamyondan olinishini tanlang";

	const fromBalance =
		balances.find((b) => b.walletId === fromWalletId)?.balance ?? 0;
	// Not an error: moving a jar into the red is sometimes the true picture, and
	// refusing it here would only push the user to record nothing at all.
	const leavesNegative =
		!!fromWalletId && Number.isFinite(amount) && amount > fromBalance;

	const submit = () => {
		setSubmitted(true);
		if (amountError || !fromWalletId || !toWalletId) return;

		onSubmit({
			fromWalletId,
			toWalletId,
			amount,
			unit,
			date: todayISO(),
			note: note.trim(),
		});
		onClose();
	};

	return (
		<BottomSheet visible={visible} onClose={onClose} maxHeight="90%">
			<ScrollView
				contentContainerStyle={{ padding: 16, gap: 16 }}
				keyboardShouldPersistTaps="handled"
			>
				<View>
					<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
						{title}
					</Text>
					{!!description && (
						<Text
							className="text-muted-foreground mt-1"
							style={{ fontSize: tf.sm }}
						>
							{description}
						</Text>
					)}
				</View>

				<WalletPicker
					label="Qaysi hamyondan"
					value={fromWalletId}
					onChange={setFromWalletId}
					wallets={wallets}
					balances={balances}
					unit={unit}
					excludeWalletId={toWalletId}
					includeUnallocated
					error={submitted ? fromError : undefined}
				/>

				<View className="items-center">
					<Ionicons name="arrow-down" size={20} color={tc.mutedForeground} />
				</View>

				<WalletPicker
					label="Qaysi hamyonga"
					value={toWalletId}
					onChange={setToWalletId}
					wallets={wallets}
					balances={balances}
					unit={unit}
					excludeWalletId={fromWalletId}
					includeUnallocated
					error={submitted && !toWalletId ? "Qabul qiluvchi hamyonni tanlang" : undefined}
				/>

				<InputField
					label="Summa"
					required
					value={amountText}
					onChangeText={setAmountText}
					placeholder="0"
					keyboardType="decimal-pad"
					inputMode="decimal"
					error={submitted ? amountError : undefined}
					hint={
						leavesNegative && fromWalletId
							? `Diqqat: bu hamyonda ${formatAmount(fromBalance, unit)} bor — o'tkazgandan keyin minusga tushadi.`
							: undefined
					}
				/>

				<InputField
					label="Izoh"
					value={note}
					onChangeText={setNote}
					placeholder="Ixtiyoriy"
				/>

				<View className="flex-row gap-3">
					<View className="flex-1">
						<Button
							label="Bekor qilish"
							variant="outline"
							color="secondary"
							fullWidth
							onPress={onClose}
						/>
					</View>
					<View className="flex-1">
						<Button label={submitLabel} fullWidth onPress={submit} />
					</View>
				</View>
			</ScrollView>
		</BottomSheet>
	);
}
