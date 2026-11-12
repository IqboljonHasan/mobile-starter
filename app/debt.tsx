import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Share, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AmountCard from "@/components/AmountCard";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import ContactPicker from "@/components/ContactPicker";
import WalletPicker from "@/components/WalletPicker";
import {
	Button,
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
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { useScrolled } from "@/hooks/useScrolled";
import { addDaysISO, addMonthsISO, todayISO } from "@/lib/date";
import { contactName, DIRECTION_META, debtShareMessage, paidAmount, remainingAmount } from "@/lib/debts";
import { formatAmount, parseAmount, unitByCode } from "@/lib/money";
import type { Debt, DebtDirection, PayMethod } from "@/lib/types";
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
 * Create or edit one debt.
 *
 * `?id=` edits an existing debt; `?direction=` starts a new one on that side,
 * and `?contactId=` fills in who it is with when started from a person's
 * screen. The same screen does both, exactly as the transaction screen does —
 * and like it, the form is a separate component mounted only once the stored
 * ledger has been read. Settling and deleting a debt live on its detail
 * screen (`debt-detail`), which this form is opened from.
 */
export default function DebtScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string; direction?: string; contactId?: string }>();
	const { ready, debts, contacts } = useLedger();

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
			// Only a person who still exists can be picked.
			initialContactId={contacts.some((c) => c.id === params.contactId) ? (params.contactId ?? null) : null}
		/>
	);
}

function DebtForm({
	existing,
	initialDirection,
	initialContactId,
}: {
	existing?: Debt;
	initialDirection: DebtDirection;
	initialContactId: string | null;
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
	} = useLedger();
	const { reminders } = usePreferences();

	const [direction, setDirection] = useState<DebtDirection>(
		existing?.direction ?? initialDirection,
	);
	const [contactId, setContactId] = useState<string | null>(
		existing?.contactId ?? initialContactId,
	);
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

	const title = existing ? "Qarzni tahrirlash" : incoming ? "Qarz olish" : "Qarz berish";
	const keyboardLift = Math.max(keyboardInset - insets.bottom, 0);

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
		...(!existing
			? [
					{
						key: "clear",
						label: "Formani tozalash",
						icon: "refresh-outline" as const,
						danger: true,
						separatorBefore: true,
						onPress: clearForm,
					},
				]
			: []),
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
		</View>
	);
}
