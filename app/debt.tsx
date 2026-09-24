import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ContactPicker from "@/components/ContactPicker";
import DebtPaymentSheet from "@/components/DebtPaymentSheet";
import WalletPicker from "@/components/WalletPicker";
import {
	Badge,
	Button,
	Card,
	DateField,
	InputField,
	SegmentedControl,
	Select,
	Textarea,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import { formatDate, formatDayLabel, todayISO } from "@/lib/date";
import {
	DIRECTION_META,
	daysUntilDue,
	debtStatus,
	paidAmount,
	paidShare,
	paymentType,
	remainingAmount,
} from "@/lib/debts";
import {
	formatAmount,
	methodByKey,
	PAY_METHODS,
	parseAmount,
	UNITS,
	unitByCode,
} from "@/lib/money";
import type { Debt, DebtDirection, DebtPayment, PayMethod } from "@/lib/types";
import { walletBalances } from "@/lib/wallets";
import "../global.css";

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
					<ActivityIndicator color={tc.primary} />
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
						className="text-muted-foreground text-center"
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
		defaultUnit,
		addDebt,
		updateDebt,
		deleteDebt,
		addDebtPayment,
		updateDebtPayment,
		deleteDebtPayment,
	} = useLedger();

	const [direction, setDirection] = useState<DebtDirection>(
		existing?.direction ?? initialDirection,
	);
	const [contactId, setContactId] = useState<string | null>(
		existing?.contactId ?? null,
	);
	const [amountText, setAmountText] = useState(
		existing ? String(existing.amount) : "",
	);
	const [unit, setUnit] = useState(existing?.unit ?? defaultUnit);
	const [method, setMethod] = useState<PayMethod>(existing?.method ?? "cash");
	const [walletId, setWalletId] = useState<string | null>(
		existing?.walletId ?? null,
	);
	const [description, setDescription] = useState(existing?.description ?? "");
	const [date, setDate] = useState(existing?.date ?? todayISO());
	const [dueDate, setDueDate] = useState<string | null>(existing?.dueDate ?? null);
	const [payOpen, setPayOpen] = useState(false);
	// Null while adding a new payment; the payment itself while editing one —
	// the sheet reads this to seed its fields and to know which mutator to call.
	const [editingPayment, setEditingPayment] = useState<DebtPayment | null>(null);
	const [submitted, setSubmitted] = useState(false);

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
			walletBalances(
				transactions,
				transfers,
				wallets,
				unit,
				existing?.transactionId ?? undefined,
			),
		[transactions, transfers, wallets, unit, existing?.transactionId],
	);

	const paid = existing ? paidAmount(existing) : 0;
	const remaining = existing ? remainingAmount(existing) : 0;
	const share = existing ? paidShare(existing) : 0;
	const status = existing ? debtStatus(existing, today) : "open";
	const days = existing ? daysUntilDue(existing, today) : null;

	// The principal can't be cut below what has already been paid against it:
	// that would leave a debt settled by payments it never had room for.
	const belowPaid =
		!!existing && !amountError && amount < paid
			? `Bu qarzga allaqachon ${formatAmount(paid, existing.unit)} to'langan.`
			: undefined;

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
		if (amountError || !contactId || belowPaid) return;

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
		};

		if (existing) updateDebt(existing.id, input);
		else addDebt(input);
		router.back();
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

	return (
		<>
			<Stack.Screen
				options={{
					title: existing
						? "Qarzni tahrirlash"
						: incoming
							? "Qarz olish"
							: "Qarz berish",
				}}
			/>
			<ScrollView
				className="flex-1 bg-background"
				style={{ marginBottom: Math.max(keyboardInset - insets.bottom, 0) }}
				contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Which way the debt runs -------------------------------------- */}
				<View className="flex-row gap-3">
					{(["borrowed", "lent"] as DebtDirection[]).map((option) => {
						const active = direction === option;
						const optionMeta = DIRECTION_META[option];
						const borrowed = option === "borrowed";
						// Locked once there are entries behind it: flipping it would
						// move every one of them to a different category.
						const locked = !!existing;
						return (
							<Pressable
								key={option}
								accessibilityRole="button"
								accessibilityState={{ selected: active, disabled: locked }}
								disabled={locked}
								onPress={() => changeDirection(option)}
								className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-70 ${
									active ? "" : "bg-card"
								} ${locked && !active ? "opacity-40" : ""}`}
								style={
									active
										? { backgroundColor: borrowed ? tc.success : tc.danger }
										: { borderWidth: 1, borderColor: tc.border }
								}
							>
								<Ionicons
									name={borrowed ? "arrow-down-circle" : "arrow-up-circle"}
									size={18}
									color={active ? "#fff" : borrowed ? tc.success : tc.danger}
								/>
								<Text
									className="font-semibold"
									style={{
										fontSize: tf.base,
										color: active ? "#fff" : tc.foreground,
									}}
								>
									{optionMeta.label}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{/* Where it stands ---------------------------------------------- */}
				{existing && (
					<Card>
						<View className="flex-row items-center justify-between gap-3">
							<View className="flex-1">
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									Qoldiq
								</Text>
								<Text
									className={`font-bold mt-0.5 ${
										status === "settled"
											? "text-muted-foreground"
											: direction === "lent"
												? "text-success"
												: "text-danger"
									}`}
									style={{ fontSize: tf.xxl }}
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
												? "Ochiq"
												: days === 0
													? "Bugun muddati"
													: `${days} kun qoldi`
								}
								tone={
									status === "settled"
										? "success"
										: status === "overdue"
											? "danger"
											: "neutral"
								}
							/>
						</View>

						<View
							className="rounded-full bg-muted mt-3 overflow-hidden"
							style={{ height: 6 }}
						>
							<View
								style={{
									width: `${Math.round(share * 100)}%`,
									height: "100%",
									borderRadius: 3,
									backgroundColor: status === "settled" ? tc.success : tc.primary,
								}}
							/>
						</View>
						<Text
							className="text-muted-foreground mt-2"
							style={{ fontSize: tf.sm }}
						>
							{`${formatAmount(paid, existing.unit)} / ${formatAmount(existing.amount, existing.unit)} · ${Math.round(share * 100)}%`}
						</Text>

						{status !== "settled" && (
							<View className="mt-3">
								<Button
									label={meta.payLabel}
									color={paymentType(direction) === "income" ? "success" : "danger"}
									fullWidth
									startIcon={
										<Ionicons name="cash-outline" size={18} color="#fff" />
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

				{/* Who it's with ------------------------------------------------- */}
				<ContactPicker
					label={meta.counterparty}
					value={contactId}
					onChange={setContactId}
					error={submitted ? contactError : undefined}
				/>

				{/* Amount and unit ----------------------------------------------- */}
				<View className="flex-row items-start gap-3">
					<View className="flex-1">
						<InputField
							label="Summa"
							required
							value={amountText}
							onChangeText={setAmountText}
							placeholder="0"
							keyboardType="decimal-pad"
							inputMode="decimal"
							error={submitted ? (amountError ?? belowPaid) : undefined}
						/>
					</View>
					<View style={{ width: 116 }}>
						<Text
							className="font-medium text-foreground mb-1.5"
							style={{ fontSize: tf.base }}
						>
							Valyuta
						</Text>
						<Select
							label="Valyuta"
							value={unit}
							onChange={(next) => next && setUnit(next)}
							toggleOff={false}
							// A debt is settled in the currency it was taken in, so once
							// something has been paid against it the unit is fixed —
							// changing it would silently reinterpret every payment.
							disabled={!!existing && existing.payments.length > 0}
							options={UNITS.map((u) => ({
								key: u.code,
								label: `${u.code} — ${u.name}`,
							}))}
							trigger={({ open }) => {
								const locked = !!existing && existing.payments.length > 0;
								return (
									<Pressable
										accessibilityRole="button"
										accessibilityLabel={`Valyuta: ${unit}`}
										disabled={locked}
										onPress={open}
										className={`flex-row items-center justify-between rounded-xl px-4 active:opacity-70 ${
											locked ? "opacity-50" : ""
										}`}
										style={{
											backgroundColor: tc.card,
											borderWidth: 1,
											borderColor: tc.border,
											minHeight: 56,
										}}
									>
										<Text
											className="font-semibold text-foreground"
											style={{ fontSize: tf.lg }}
										>
											{unit}
										</Text>
										<Ionicons
											name="chevron-down"
											size={16}
											color={tc.mutedForeground}
										/>
									</Pressable>
								);
							}}
						/>
					</View>
				</View>
				{!amountError && (
					<Text className="text-muted-foreground -mt-3" style={{ fontSize: tf.sm }}>
						{incoming ? "+" : "−"}
						{formatAmount(amount, unit)} · {unitByCode(unit).name}
					</Text>
				)}

				{/* How it moved --------------------------------------------------- */}
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

				{/* Which jar it touched ------------------------------------------- */}
				<View>
					<WalletPicker
						label={incoming ? "Qaysi hamyonga tushdi" : "Qaysi hamyondan"}
						value={walletId}
						onChange={setWalletId}
						wallets={wallets}
						balances={balances}
						unit={unit}
						allowNone
						includeUnallocated
					/>
					<Text
						className="text-muted-foreground mt-1.5"
						style={{ fontSize: tf.sm }}
					>
						{incoming
							? "Olingan pul shu hamyonga qo'shiladi — to'laganda esa shu yerdan yechiladi."
							: "Bergan pulingiz shu hamyondan yechiladi — undirganda qaytadi."}
					</Text>
				</View>

				{/* When ------------------------------------------------------------ */}
				<DateField
					label={incoming ? "Qachon oldingiz" : "Qachon berdingiz"}
					required
					value={date}
					onChange={setDate}
					maxDate={today}
				/>

				<View>
					<View className="flex-row items-center justify-between mb-1.5">
						<Text
							className="font-medium text-foreground"
							style={{ fontSize: tf.base }}
						>
							Muddat
						</Text>
						{!!dueDate && (
							<Pressable
								accessibilityRole="button"
								onPress={() => setDueDate(null)}
								className="px-3 py-1 rounded-full bg-muted active:opacity-70"
							>
								<Text
									className="font-medium text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									Tozalash
								</Text>
							</Pressable>
						)}
					</View>
					{dueDate ? (
						// No `maxDate`: a due date is meant to be in the future, which is
						// the one date in this app that legitimately hasn't happened yet.
						<DateField value={dueDate} onChange={setDueDate} />
					) : (
						<Pressable
							accessibilityRole="button"
							onPress={() => setDueDate(today)}
							className="flex-row items-center gap-3 rounded-xl px-5 active:opacity-70"
							style={{
								backgroundColor: tc.card,
								borderWidth: 1,
								borderColor: tc.border,
								minHeight: 56,
							}}
						>
							<Ionicons
								name="alarm-outline"
								size={20}
								color={tc.mutedForeground}
							/>
							<Text
								className="flex-1"
								style={{ fontSize: tf.lg, color: tc.placeholder }}
							>
								Muddat belgilanmagan
							</Text>
							<Ionicons name="add" size={18} color={tc.mutedForeground} />
						</Pressable>
					)}
				</View>

				<Textarea
					label="Izoh"
					rows={2}
					value={description}
					onChangeText={setDescription}
					placeholder="Nima uchun?"
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
							className="text-muted-foreground px-4 py-2.5"
							style={{ fontSize: tf.xs }}
						>
							{"Tahrirlash uchun bosing, o'chirish uchun uzoq bosing."}
						</Text>
					</Card>
				)}

				{/* Save ------------------------------------------------------------ */}
				<Button
					label={existing ? "Saqlash" : incoming ? "Qarzni qo'shish" : "Qarzni berish"}
					size="lg"
					fullWidth
					onPress={save}
				/>

				{!!existing && (
					<Button
						label="Qarzni o'chirish"
						variant="text"
						color="danger"
						fullWidth
						onPress={confirmDelete}
					/>
				)}
			</ScrollView>

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
		</>
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
			className={`flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${
				divider ? "border-t border-border" : ""
			}`}
		>
			<View className="w-9 h-9 rounded-full items-center justify-center bg-primary-highlight">
				<Ionicons
					name={methodByKey(payment.method).icon}
					size={16}
					color={tc.primary}
				/>
			</View>
			<View className="flex-1">
				<Text className="font-medium text-foreground" style={{ fontSize: tf.base }}>
					{formatAmount(payment.amount, unit)}
				</Text>
				<Text
					className="text-muted-foreground"
					style={{ fontSize: tf.sm }}
					numberOfLines={1}
				>
					{payment.note || formatDayLabel(payment.date)}
				</Text>
			</View>
			<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
				{formatDate(payment.date)}
			</Text>
		</Pressable>
	);
}
