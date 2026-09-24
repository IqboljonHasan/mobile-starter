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
import type { Debt, DebtPayment, DebtPaymentInput, PayMethod } from "@/lib/types";
import { walletBalances } from "@/lib/wallets";

/**
 * Records money moving against one debt — a repayment on what the user
 * borrowed, or a collection on what they lent — or edits one already
 * recorded.
 *
 * A new payment opens with the full remaining balance filled in, because
 * settling a debt in one go is the common case and the exact figure is the
 * thing the user would otherwise have to go and look up. A smaller amount is
 * simply typed over it. However much is typed, it can never exceed what the
 * debt still owes: `cap` is that ceiling, and for an edit it counts the
 * payment's own current amount back in first — editing 100 down to 80 must
 * not be judged against a remaining balance that 100 has already been
 * subtracted from.
 *
 * Its fields are seeded on mount, so give it a `key` that changes when it
 * opens.
 */
export default function DebtPaymentSheet({
	visible,
	onClose,
	onSubmit,
	debt,
	existing,
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (input: DebtPaymentInput) => void;
	debt: Debt;
	/** Editing this payment rather than recording a new one. */
	existing?: DebtPayment;
}) {
	const { tf } = useFont();
	const { transactions, transfers, wallets } = useLedger();

	const meta = DIRECTION_META[debt.direction];
	const remaining = remainingAmount(debt);
	// The most this payment could be saved as: the debt's remaining balance,
	// plus — when editing — the amount this same payment already accounts for,
	// since that's room the debt hands back the moment its old value is
	// replaced rather than room that has to come from anywhere else.
	const cap = roundAmount(remaining + (existing?.amount ?? 0), debt.unit);
	const incoming = paymentType(debt.direction) === "income";

	const [amountText, setAmountText] = useState(
		existing ? String(existing.amount) : cap > 0 ? String(cap) : "",
	);
	const [date, setDate] = useState(existing?.date ?? todayISO());
	const [method, setMethod] = useState<PayMethod>(existing?.method ?? debt.method);
	const [walletId, setWalletId] = useState<string | null>(
		existing ? existing.walletId : debt.walletId,
	);
	const [note, setNote] = useState(existing?.note ?? "");
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
			: amount > cap
				? `Qoldiqdan ko'p bo'lmasligi kerak: ${formatAmount(cap, debt.unit)}`
				: undefined;

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
						{existing ? `${meta.payLabel}ni tahrirlash` : meta.payLabel}
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
							!amountError && cap > 0 && amount === cap
								? "Qarz to'liq yopiladi."
								: undefined
						}
					/>
					{/* Half is what a part-payment almost always is, and the full
					    balance is one tap back from wherever the user has typed to. */}
					{cap > 0 && (
						<View className="flex-row gap-2 mt-2">
							<QuickAmount
								label="Yarmi"
								onPress={() =>
									setAmountText(String(roundAmount(cap / 2, debt.unit)))
								}
							/>
							<QuickAmount
								label="To'liq"
								onPress={() => setAmountText(String(cap))}
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
							label={existing ? "Saqlash" : meta.payLabel}
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
