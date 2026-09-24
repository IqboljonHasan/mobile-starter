import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import WalletPicker from "@/components/WalletPicker";
import {
	BottomSheet,
	Button,
	DateField,
	InputField,
	SegmentedControl,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { todayISO } from "@/lib/date";
import { DIRECTION_META, paymentType, remainingAmount } from "@/lib/debts";
import { formatAmount, PAY_METHODS, parseAmount, roundAmount } from "@/lib/money";
import type { Debt, DebtPaymentInput, PayMethod } from "@/lib/types";
import { walletBalances } from "@/lib/wallets";

/**
 * Records money moving against one debt — a repayment on what the user
 * borrowed, or a collection on what they lent.
 *
 * It opens with the full remaining balance filled in, because settling a debt
 * in one go is the common case and the exact figure is the thing the user
 * would otherwise have to go and look up. A smaller amount is simply typed
 * over it.
 *
 * Its fields are seeded on mount, so give it a `key` that changes when it
 * opens.
 */
export default function DebtPaymentSheet({
	visible,
	onClose,
	onSubmit,
	debt,
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (input: DebtPaymentInput) => void;
	debt: Debt;
}) {
	const { tf } = useFont();
	const { transactions, transfers, wallets } = useLedger();

	const meta = DIRECTION_META[debt.direction];
	const remaining = remainingAmount(debt);
	const incoming = paymentType(debt.direction) === "income";

	const [amountText, setAmountText] = useState(
		remaining > 0 ? String(remaining) : "",
	);
	const [date, setDate] = useState(todayISO());
	const [method, setMethod] = useState<PayMethod>(debt.method);
	const [walletId, setWalletId] = useState<string | null>(debt.walletId);
	const [note, setNote] = useState("");
	const [submitted, setSubmitted] = useState(false);

	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, debt.unit),
		[transactions, transfers, wallets, debt.unit],
	);

	const amount = parseAmount(amountText);
	const amountError = !amountText.trim()
		? "Summani kiriting"
		: !Number.isFinite(amount) || amount <= 0
			? "Summa noldan katta bo'lishi kerak"
			: undefined;

	// Paying more than is left isn't refused — the user may be settling
	// interest, or correcting an amount that was entered short — but it is said
	// out loud, because the overpayment doesn't become a debt the other way.
	const overpay =
		!amountError && amount > remaining
			? roundAmount(amount - remaining, debt.unit)
			: 0;

	const available =
		walletId && !incoming
			? (balances.find((b) => b.walletId === walletId)?.balance ?? 0)
			: 0;

	const submit = () => {
		setSubmitted(true);
		if (amountError) return;
		onSubmit({
			amount,
			date,
			method,
			walletId,
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
						{meta.payLabel}
					</Text>
					<Text className="text-muted-foreground mt-1" style={{ fontSize: tf.sm }}>
						{`Qoldiq: ${formatAmount(remaining, debt.unit)}`}
					</Text>
				</View>

				<View>
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
							overpay > 0
								? `Qoldiqdan ${formatAmount(overpay, debt.unit)} ortiq — qarz to'liq yopiladi.`
								: undefined
						}
					/>
					{/* Half is what a part-payment almost always is, and the full
					    balance is one tap back from wherever the user has typed to. */}
					{remaining > 0 && (
						<View className="flex-row gap-2 mt-2">
							<QuickAmount
								label="Yarmi"
								onPress={() =>
									setAmountText(String(roundAmount(remaining / 2, debt.unit)))
								}
							/>
							<QuickAmount
								label="To'liq"
								onPress={() => setAmountText(String(remaining))}
							/>
						</View>
					)}
				</View>

				<View>
					<Text
						className="font-medium text-foreground mb-1.5"
						style={{ fontSize: tf.base }}
					>
						{"To'lov turi"}
					</Text>
					<SegmentedControl
						items={PAY_METHODS}
						value={method}
						onChange={setMethod}
						className="bg-muted"
					/>
				</View>

				<View>
					<WalletPicker
						label={incoming ? "Qaysi hamyonga tushdi" : "Qaysi hamyondan"}
						value={walletId}
						onChange={setWalletId}
						wallets={wallets}
						balances={balances}
						unit={debt.unit}
						allowNone
						includeUnallocated
					/>
					{/* Said, not enforced: a debt has to be repaid whether or not the
					    jar it was assigned to can cover it, and refusing the record
					    would only mean the repayment goes unrecorded. */}
					{!incoming && walletId && !amountError && amount > available && (
						<Text className="text-warning mt-1.5" style={{ fontSize: tf.sm }}>
							{`Bu hamyonda ${formatAmount(available, debt.unit)} bor — yozuvdan keyin minusga tushadi.`}
						</Text>
					)}
				</View>

				<DateField label="Sana" required value={date} onChange={setDate} maxDate={todayISO()} />

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
						<Button
							label={meta.payLabel}
							color={incoming ? "success" : "danger"}
							fullWidth
							onPress={submit}
						/>
					</View>
				</View>
			</ScrollView>
		</BottomSheet>
	);
}

function QuickAmount({ label, onPress }: { label: string; onPress: () => void }) {
	const { tf } = useFont();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			className="px-3.5 py-2 rounded-full bg-muted active:opacity-70"
		>
			<Text className="font-medium text-foreground" style={{ fontSize: tf.sm }}>
				{label}
			</Text>
		</Pressable>
	);
}
