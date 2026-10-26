import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AmountCard from "@/components/AmountCard";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import ContactPicker from "@/components/ContactPicker";
import DebtPaymentSheet from "@/components/DebtPaymentSheet";
import WalletPicker from "@/components/WalletPicker";
import {
	Badge,
	Button,
	Card,
	Chip,
	DateField,
	FieldLabel,
	HeaderMenu,
	type HeaderMenuItem,
	NumberPad,
	Textarea,
	Toggle,
} from "@/components/ui";
import { Text } from "@/components/ui/Text";
import ScrollShadow from "@/components/ScrollShadow";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { useScrolled } from "@/hooks/useScrolled";
import { addDaysISO, addMonthsISO, formatDate, formatDayLabel, todayISO } from "@/lib/date";
import {
	contactName,
	DIRECTION_META,
	daysUntilDue,
	debtShareMessage,
	debtStatus,
	paidAmount,
	paidShare,
	paymentType,
	remainingAmount,
} from "@/lib/debts";
import { formatAmount, methodByKey, parseAmount, unitByCode } from "@/lib/money";
import type { Debt, DebtDirection, DebtPayment, PayMethod } from "@/lib/types";
import { requestReminderPermission } from "@/lib/debtReminders";
import { walletBalances } from "@/lib/wallets";
import "../global.css";

/** The usual terms, one tap each — counted from the day the money moved. */
const TERMS: { key: string; label: string; due: (from: string) => string | null }[] = [
	{ key: "week", label: "1 hafta", due: (from) => addDaysISO(from, 7) },
	{ key: "month", label: "1 oy", due: (from) => addMonthsISO(from, 1) },
	{ key: "quarter", label: "3 oy", due: (from) => addMonthsISO(from, 3) },
	{ key: "none", label: "Muddatsiz", due: () => null },
];

/**
 * Create or edit one debt, and settle it.
 *
 * `?id=` opens an existing debt with its payment history; `?direction=` starts
 * a new one on that side. The same screen does both, exactly as the
 * transaction screen does — and like it, the form is a separate component
 * mounted only once the stored ledger has been read.
 */
export default function DebtScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string; direction?: string }>();
	const { ready, debts } = useLedger();

	const existing = params.id ? debts.find((d) => d.id === params.id) : undefined;

	if (!ready) {
		return (
			<>
				<Stack.Screen options={{ title: "Qarz" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.foreground} />
				</View>
			</>
		);
	}

	if (params.id && !existing) {
		return (
			<>
				<Stack.Screen options={{ title: "Qarz" }} />
				<View className="flex-1 bg-background items-center justify-center px-8">
					<Text
						className="font-semibold text-muted-foreground text-center"
						style={{ fontSize: tf.base }}
					>
						{"Bu qarz endi mavjud emas."}
					</Text>
				</View>
			</>
		);
	}

	return (
		<DebtForm
			key={existing?.id ?? "new"}
			existing={existing}
			initialDirection={params.direction === "lent" ? "lent" : "borrowed"}
		/>
	);
}

function DebtForm({
	existing,
	initialDirection,
}: {
	existing?: Debt;
	initialDirection: DebtDirection;
}) {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const insets = useSafeAreaInsets();
	const keyboardInset = useKeyboardInset();
	const {
		transactions,
		transfers,
		wallets,
		contacts,
		defaultUnit,
		addDebt,
		updateDebt,
		deleteDebt,
		addDebtPayment,
		updateDebtPayment,
		deleteDebtPayment,
	} = useLedger();
	const { reminders } = usePreferences();

	const [direction, setDirection] = useState<DebtDirection>(
		existing?.direction ?? initialDirection,
	);
	const [contactId, setContactId] = useState<string | null>(existing?.contactId ?? null);
	const [amountText, setAmountText] = useState(existing ? String(existing.amount) : "");
	const [unit, setUnit] = useState(existing?.unit ?? defaultUnit);
	const [method, setMethod] = useState<PayMethod>(existing?.method ?? "cash");
	const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? null);
	const [description, setDescription] = useState(existing?.description ?? "");
	const [date, setDate] = useState(existing?.date ?? todayISO());
	const [dueDate, setDueDate] = useState<string | null>(existing?.dueDate ?? null);
	// On by default for a new debt — a due date is set to be kept — and as
	// saved for one being edited.
	const [remind, setRemind] = useState(existing?.remind ?? true);
	const [payOpen, setPayOpen] = useState(false);
	// Null while adding a new payment; the payment itself while editing one —
	// the sheet reads this to seed its fields and to know which mutator to call.
	const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null);
	const [padOpen, setPadOpen] = useState(false);
	const [submitted, setSubmitted] = useState(false);
	const { scrolled, scrollProps } = useScrolled();

	const today = todayISO();
	const meta = DIRECTION_META[direction];
	const incoming = direction === "borrowed";

	const amount = parseAmount(amountText);
	const amountError = !amountText.trim()
		? "Summani kiriting"
		: !Number.isFinite(amount) || amount <= 0
			? "Summa noldan katta bo'lishi kerak"
			: undefined;
	const contactError = contactId ? undefined : "Kimligini tanlang";

	// The principal's own entry is left out, so editing a debt measures the
	// wallet against the balance without its older self still counted.
	const balances = useMemo(
		() =>
			walletBalances(transactions, transfers, wallets, unit, existing?.transactionId ?? undefined),
		[transactions, transfers, wallets, unit, existing?.transactionId],
	);

	const paid = existing ? paidAmount(existing) : 0;
	const remaining = existing ? remainingAmount(existing) : 0;
	const share = existing ? paidShare(existing) : 0;
	const status = existing ? debtStatus(existing, today) : "open";
	const days = existing ? daysUntilDue(existing, today) : null;
	// A debt is settled in the currency it was taken in, so once something has
	// been paid against it the unit is fixed — changing it would silently
	// reinterpret every payment.
	const unitLocked = !!existing && existing.payments.length > 0;

	// The principal can't be cut below what has already been paid against it:
	// that would leave a debt settled by payments it never had room for.
	const belowPaid =
		!!existing && !amountError && amount < paid
			? `Bu qarzga allaqachon ${formatAmount(paid, existing.unit)} to'langan.`
			: undefined;

	// A due date before the day the money moved can only be a slip.
	const dueError =
		dueDate && dueDate < date ? "Muddat qarz sanasidan oldin bo'lishi mumkin emas" : undefined;

	const changeDirection = (next: DebtDirection) => {
		if (next === direction) return;
		// Which way it runs decides which categories every entry is filed under,
		// so an existing debt's direction is fixed — the form only offers the
		// switch while nothing has been written yet.
		setDirection(next);
		setWalletId(null);
	};

	const save = () => {
		setSubmitted(true);
		if (amountError || !contactId || belowPaid || dueError) return;

		const input = {
			direction,
			contactId,
			amount,
			unit,
			method,
			walletId,
			description: description.trim(),
			date,
			dueDate,
			remind,
		};

		if (existing) updateDebt(existing.id, input);
		else addDebt(input);
		// Asked here, where a reminder was just wanted, rather than on first
		// launch; the reminders are scheduled once the answer is in.
		if (remind && dueDate && reminders.enabled) requestReminderPermission();
		router.back();
	};

	// Back to a blank form for this side, as it opened.
	const clearForm = () => {
		setContactId(null);
		setAmountText("");
		setUnit(defaultUnit);
		setMethod("cash");
		setWalletId(null);
		setDescription("");
		setDate(todayISO());
		setDueDate(null);
		setRemind(true);
		setSubmitted(false);
	};

	// A note of the debt for the other person, through whichever messenger
	// the user picks — the debt as the form holds it, saved or not.
	const shareDebt = () => {
		if (!contactId || amountError) {
			Alert.alert("Avval kishi va summani kiriting", "Xabar shu ma'lumotlardan tuziladi.");
			return;
		}
		Share.share({
			message: debtShareMessage({
				direction,
				name: contactName(contacts, contactId),
				amount,
				remaining: existing ? remainingAmount(existing) : undefined,
				unit,
				date,
				dueDate,
			}),
		});
	};

	const confirmDelete = () => {
		if (!existing) return;
		const entries = 1 + existing.payments.length;
		Alert.alert(
			"Qarz o'chirilsinmi?",
			`${formatAmount(existing.amount, existing.unit)}. Hisobdagi ${entries} ta yozuv ham o'chadi. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => {
						deleteDebt(existing.id);
						router.back();
					},
				},
			],
		);
	};

	const confirmDeletePayment = (paymentId: string, label: string) => {
		if (!existing) return;
		Alert.alert(
			"To'lov o'chirilsinmi?",
			`${label}. Hisobdagi yozuv ham o'chadi va qoldiq ortadi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteDebtPayment(existing.id, paymentId),
				},
			],
		);
	};

	const title = existing ? "Qarzni tahrirlash" : incoming ? "Qarz olish" : "Qarz berish";
	const keyboardLift = Math.max(keyboardInset - insets.bottom, 0);
	const collecting = paymentType(direction) === "income";

	const menuItems: HeaderMenuItem[] = [
		{
			key: "share",
			label: incoming ? "Qarz beruvchiga yuborish" : "Qarzdorga yuborish",
			icon: "share-social-outline",
			onPress: shareDebt,
		},
		...(!existing
			? [
					{
						key: "direction",
						label: incoming ? "Qarz berishga o'tish" : "Qarz olishga o'tish",
						icon: "swap-vertical-outline" as const,
						onPress: () => changeDirection(incoming ? "lent" : "borrowed"),
					},
				]
			: []),
		existing
			? {
					key: "delete",
					label: "Qarzni o'chirish",
					icon: "trash-outline",
					danger: true,
					separatorBefore: true,
					onPress: confirmDelete,
				}
			: {
					key: "clear",
					label: "Formani tozalash",
					icon: "refresh-outline",
					danger: true,
					separatorBefore: true,
					onPress: clearForm,
				},
	];

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title,
					headerRight: () => <HeaderMenu items={menuItems} />,
				}}
			/>
			<ScrollView
				{...scrollProps}
				className="flex-1"
				style={{ marginBottom: keyboardLift }}
				contentContainerStyle={{
					paddingHorizontal: 18,
					paddingTop: 4,
					paddingBottom: padOpen ? 24 : BOTTOM_BAR_SPACE,
					gap: 16,
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Where it stands ---------------------------------------------- */}
				{existing && (
					<Card>
						<View className="flex-row items-center justify-between gap-3">
							<View className="flex-1">
								<Text className="font-bold text-muted-foreground" style={{ fontSize: tf.sm }}>
									Qoldiq
								</Text>
								<Text
									className="font-extrabold mt-0.5"
									style={{
										fontSize: tf.xxl + 2,
										letterSpacing: -0.4,
										color:
											status === "settled"
												? tc.mutedForeground
												: direction === "lent"
													? tc.success
													: tc.danger,
									}}
									numberOfLines={1}
									adjustsFontSizeToFit
								>
									{formatAmount(remaining, existing.unit)}
								</Text>
							</View>
							<Badge
								label={
									status === "settled"
										? "Yopilgan"
										: status === "overdue"
											? `${Math.abs(days ?? 0)} kun kechikdi`
											: days === null
												? "Muddatsiz"
												: days === 0
													? "Bugun muddati"
													: `${days} kun qoldi`
								}
								tone={status === "settled" ? "success" : status === "overdue" ? "danger" : "neutral"}
							/>
						</View>

						<View className="rounded-full bg-background mt-3 overflow-hidden" style={{ height: 6 }}>
							<View
								style={{
									width: `${Math.round(share * 100)}%`,
									height: "100%",
									borderRadius: 3,
									backgroundColor:
										status === "settled" ? tc.success : direction === "lent" ? tc.success : tc.danger,
								}}
							/>
						</View>
						<Text className="font-semibold text-muted-foreground mt-2" style={{ fontSize: tf.sm }}>
							{`${formatAmount(paid, existing.unit)} / ${formatAmount(existing.amount, existing.unit)} · ${Math.round(share * 100)}% qaytarildi`}
						</Text>

						{status !== "settled" && (
							<View className="mt-3">
								<Button
									label={meta.payLabel}
									variant="soft"
									color={collecting ? "success" : "danger"}
									fullWidth
									startIcon={
										<Ionicons
											name="cash-outline"
											size={18}
											color={collecting ? tc.success : tc.danger}
										/>
									}
									onPress={() => {
										setEditingPayment(null);
										setPayOpen(true);
									}}
								/>
							</View>
						)}
					</Card>
				)}

				{/* Amount, how it moved, and in what ----------------------------- */}
				<AmountCard
					value={amountText}
					autoFocus={!existing}
					onFocus={() => setPadOpen(true)}
					onBlur={() => setPadOpen(false)}
					method={method}
					onMethodChange={setMethod}
					unit={unit}
					onUnitChange={setUnit}
					unitLocked={unitLocked}
					error={submitted ? (amountError ?? belowPaid) : undefined}
				/>

				{/* Who it's with ------------------------------------------------- */}
				<ContactPicker
					label={meta.counterparty}
					sheetTitle={incoming ? "Kimdan oldingiz?" : "Kimga berdingiz?"}
					unit={unit}
					value={contactId}
					onChange={setContactId}
					error={submitted ? contactError : undefined}
				/>

				{/* Which jar it touched ------------------------------------------- */}
				<View>
					<WalletPicker
						label={incoming ? "Qaysi hamyonga" : "Qaysi hamyondan"}
						value={walletId}
						onChange={setWalletId}
						wallets={wallets}
						balances={balances}
						unit={unit}
						allowNone
						includeUnallocated
					/>
					<Text
						className="font-semibold text-muted-foreground mt-1.5 ml-1"
						style={{ fontSize: tf.sm }}
					>
						{incoming
							? "Olingan pul shu hamyonga qo'shiladi — to'laganda esa shu yerdan yechiladi."
							: "Bergan pulingiz shu hamyondan yechiladi — undirganda qaytadi."}
					</Text>
				</View>

				{/* When ------------------------------------------------------------ */}
				<DateField
					label={incoming ? "Olingan sana" : "Berilgan sana"}
					required
					value={date}
					onChange={setDate}
					maxDate={today}
				/>

				<View>
					<FieldLabel>Qaytarish muddati</FieldLabel>
					{/* No `maxDate`: a due date is meant to be in the future, which is
					    the one date in this app that legitimately hasn't happened yet. */}
					<DateField
						value={dueDate ?? addMonthsISO(date, 1)}
						onChange={setDueDate}
						minDate={date}
						placeholder={dueDate ? undefined : "Muddatsiz"}
						quickPicks={TERMS.flatMap((term) => {
							const due = term.due(date);
							return due ? [{ label: term.label, iso: due }] : [];
						})}
					/>
					<ScrollView
						horizontal
						accessibilityRole="radiogroup"
						accessibilityLabel="Muddatni tez tanlash"
						showsHorizontalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						style={{ marginTop: 8, marginHorizontal: -18 }}
						contentContainerStyle={{ gap: 6, paddingHorizontal: 18 }}
					>
						{TERMS.map((term) => {
							const due = term.due(date);
							return (
								<Chip
									key={term.key}
									size="sm"
									role="radio"
									label={term.label}
									active={dueDate === due}
									onPress={() => setDueDate(due)}
								/>
							);
						})}
					</ScrollView>
					{submitted && !!dueError && (
						<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
							{dueError}
						</Text>
					)}
				</View>

				{/* A reminder only makes sense with a date to be reminded of. */}
				{!!dueDate && (
					<View
						className="flex-row items-center bg-card"
						style={{ borderRadius: 20, gap: 12, paddingVertical: 12, paddingLeft: 14, paddingRight: 8 }}
					>
						<View
							className="items-center justify-center bg-background"
							style={{ width: 40, height: 40, borderRadius: 12 }}
						>
							<Ionicons name="notifications-outline" size={20} color={tc.foreground} />
						</View>
						<View className="flex-1" style={{ gap: 2 }}>
							<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
								Eslatma
							</Text>
							<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 0.5 }}>
								{reminders.enabled
									? reminders.daysBefore === 0
										? `Muddat kuni, ${String(reminders.hour).padStart(2, "0")}:00`
										: `Muddatdan ${reminders.daysBefore} kun oldin`
									: "Eslatmalar o'chirilgan — Qarzlar menyusidan yoqing"}
							</Text>
						</View>
						<Toggle
							value={remind}
							onValueChange={setRemind}
							accessibilityLabel="Muddatdan oldin eslatish"
						/>
					</View>
				)}

				<Textarea
					label="Izoh"
					rows={4}
					value={description}
					onChangeText={setDescription}
					placeholder={incoming ? "Masalan: uy ta'miri uchun" : "Masalan: mashina ta'miri uchun"}
				/>

				{/* What has been paid so far --------------------------------------- */}
				{!!existing && existing.payments.length > 0 && (
					<Card flush title={meta.payPlural}>
						{[...existing.payments]
							.sort((a, b) =>
								a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
							)
							.map((payment, index) => (
								<PaymentRow
									key={payment.id}
									payment={payment}
									unit={existing.unit}
									divider={index > 0}
									onPress={() => {
										setEditingPayment(payment);
										setPayOpen(true);
									}}
									onDelete={() =>
										confirmDeletePayment(
											payment.id,
											`${formatAmount(payment.amount, existing.unit)} · ${formatDayLabel(payment.date)}`,
										)
									}
								/>
							))}
						<Text
							className="font-semibold text-muted-foreground px-4 py-2.5"
							style={{ fontSize: tf.xs }}
						>
							{"Tahrirlash uchun bosing, o'chirish uchun uzoq bosing."}
						</Text>
					</Card>
				)}
			</ScrollView>
			<ScrollShadow visible={scrolled} />

			{padOpen ? (
				<NumberPad
					visible
					value={amountText}
					onChange={setAmountText}
					decimals={unitByCode(unit).decimals}
				/>
			) : (
				<BottomBar lift={keyboardLift}>
					<View className="flex-1">
						<Button
							label={
								existing
									? "Saqlash"
									: incoming
										? "Olingan qarzni qo'shish"
										: "Berilgan qarzni qo'shish"
							}
							size="lg"
							fullWidth
							onPress={save}
						/>
					</View>
				</BottomBar>
			)}

			{!!existing && (
				<DebtPaymentSheet
					key={payOpen ? `pay-open-${editingPayment?.id ?? "new"}` : "pay-closed"}
					visible={payOpen}
					onClose={() => setPayOpen(false)}
					debt={existing}
					existing={editingPayment ?? undefined}
					onSubmit={(input) =>
						editingPayment
							? updateDebtPayment(existing.id, editingPayment.id, input)
							: addDebtPayment(existing.id, input)
					}
				/>
			)}
		</View>
	);
}

/** One entry in a debt's payment history — tap to edit, hold to delete. */
function PaymentRow({
	payment,
	unit,
	divider,
	onPress,
	onDelete,
}: {
	payment: DebtPayment;
	unit: string;
	divider?: boolean;
	onPress: () => void;
	onDelete: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const handlePress = useGuardedPress(onPress);

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${formatAmount(payment.amount, unit)}, ${formatDate(payment.date)} — tahrirlash`}
			onPress={handlePress}
			onLongPress={onDelete}
			className={`flex-row items-center gap-3 px-3.5 py-3 active:opacity-70 ${
				divider ? "border-t border-border" : ""
			}`}
		>
			<View
				className="items-center justify-center bg-background"
				style={{ width: 32, height: 32, borderRadius: 10 }}
			>
				<Ionicons name={methodByKey(payment.method).icon} size={17} color={tc.foreground} />
			</View>
			<View className="flex-1 gap-px">
				<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
					{formatAmount(payment.amount, unit)}
				</Text>
				<Text
					className="font-semibold text-muted-foreground"
					style={{ fontSize: tf.sm - 1 }}
					numberOfLines={1}
				>
					{payment.note || formatDayLabel(payment.date)}
				</Text>
			</View>
			<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm }}>
				{formatDate(payment.date)}
			</Text>
		</Pressable>
	);
}
