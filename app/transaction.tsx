import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
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
import CategoryAvatar from "@/components/CategoryAvatar";
import TransferSheet from "@/components/TransferSheet";
import WalletPicker from "@/components/WalletPicker";
import {
	Button,
	DateField,
	InputField,
	SegmentedControl,
	Select,
	Textarea,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/hooks/useTheme";
import { categoryColorValue } from "@/lib/categoryColors";
import { formatDayLabel, todayISO } from "@/lib/date";
import {
	DEFAULT_METHOD,
	formatAmount,
	maskAmount,
	parseAmount,
	PAY_METHODS,
	UNITS,
	unitByCode,
} from "@/lib/money";
import { contactName, DIRECTION_META, remainingAmount } from "@/lib/debts";
import {
	splitAmount,
	splitsIncome,
	walletBalances,
	walletColor,
	walletName,
} from "@/lib/wallets";
import type { Debt, PayMethod, Transaction, TxType } from "@/lib/types";
import "../global.css";

/**
 * Create or edit one entry. The same screen does both: `?id=` opens an existing
 * transaction, `?type=income|expense` starts a new one on that side of the
 * ledger.
 *
 * The form is a separate component below, mounted only once the stored ledger
 * has been read: its fields are initialised from the entry being edited, and on
 * a cold start (a deep link straight to this route) that entry isn't in memory
 * yet.
 */
export default function TransactionScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ id?: string; type?: string }>();
	const { ready, transactions, debts } = useLedger();

	const existing = params.id ? transactions.find((t) => t.id === params.id) : undefined;
	// An entry the Debts tab wrote is the ledger's side of a debt, not a record
	// of its own. Editing it here would let the two disagree — the debt would
	// still say 500 000 while the entry said 300 000 — so this one is read from
	// here and changed there.
	const owningDebt = existing?.debtId
		? (debts.find((d) => d.id === existing.debtId) ?? null)
		: null;

	if (!ready) {
		return (
			<>
				<Stack.Screen options={{ title: "Yozuv" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</>
		);
	}

	if (params.id && !existing) {
		return (
			<>
				<Stack.Screen options={{ title: "Yozuv" }} />
				<View className="flex-1 bg-background items-center justify-center px-8">
					<Text
						className="text-muted-foreground text-center"
						style={{ fontSize: tf.base }}
					>
						{"Bu yozuv endi mavjud emas."}
					</Text>
				</View>
			</>
		);
	}

	if (existing && owningDebt) {
		return <DebtOwnedEntry transaction={existing} debt={owningDebt} />;
	}

	return (
		<TransactionForm
			// Remounting on a different entry is the point: every field is seeded
			// from `existing` on mount.
			key={existing?.id ?? "new"}
			existing={existing}
			initialType={params.type === "income" ? "income" : "expense"}
		/>
	);
}

/**
 * What the user sees when they open a ledger entry that belongs to a debt:
 * the entry, read-only, and the way through to where it can actually be
 * changed.
 */
function DebtOwnedEntry({
	transaction,
	debt,
}: {
	transaction: Transaction;
	debt: Debt;
}) {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const { contacts } = useLedger();

	const meta = DIRECTION_META[debt.direction];
	const isPrincipal = debt.transactionId === transaction.id;
	const name = contactName(contacts, debt.contactId);

	return (
		<>
			<Stack.Screen options={{ title: "Qarz yozuvi" }} />
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 16 }}
			>
				<View
					className="rounded-2xl bg-card p-4 items-center"
					style={{ borderWidth: 1, borderColor: tc.border }}
				>
					<View className="w-14 h-14 rounded-full items-center justify-center bg-primary-highlight">
						<Ionicons name="people-outline" size={26} color={tc.primary} />
					</View>
					<Text
						className={`font-bold mt-3 ${
							transaction.type === "income" ? "text-success" : "text-danger"
						}`}
						style={{ fontSize: tf.xxxl }}
						numberOfLines={1}
						adjustsFontSizeToFit
					>
						{transaction.type === "income" ? "+" : "−"}
						{formatAmount(transaction.amount, transaction.unit)}
					</Text>
					<Text
						className="text-muted-foreground mt-1 text-center"
						style={{ fontSize: tf.base }}
					>
						{`${name} · ${formatDayLabel(transaction.date)}`}
					</Text>
				</View>

				<View
					className="rounded-2xl bg-card p-4 gap-1"
					style={{ borderWidth: 1, borderColor: tc.border }}
				>
					<Text
						className="font-semibold text-foreground"
						style={{ fontSize: tf.base }}
					>
						{isPrincipal
							? `Bu yozuv "${meta.label}" qarzining o'zi`
							: `Bu yozuv qarz bo'yicha ${meta.payLabel.toLowerCase()}`}
					</Text>
					<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
						{`Summani yoki sanani o'zgartirish uchun qarzning o'zini tahrirlang — aks holda qarz qoldig'i bilan hisob bir-biriga to'g'ri kelmay qoladi. Hozirgi qoldiq: ${formatAmount(remainingAmount(debt), debt.unit)}.`}
					</Text>
				</View>

				<Button
					label="Qarzni ochish"
					size="lg"
					fullWidth
					startIcon={<Ionicons name="open-outline" size={18} color="#fff" />}
					onPress={() => router.replace(`/debt?id=${debt.id}`)}
				/>
				<Button
					label="Orqaga"
					variant="text"
					color="secondary"
					fullWidth
					onPress={() => router.back()}
				/>
			</ScrollView>
		</>
	);
}

function TransactionForm({
	existing,
	initialType,
}: {
	existing?: Transaction;
	initialType: TxType;
}) {
	const router = useRouter();
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const insets = useSafeAreaInsets();
	const keyboardInset = useKeyboardInset();
	const {
		categories,
		wallets,
		transactions,
		transfers,
		defaultUnit,
		addTransaction,
		updateTransaction,
		deleteTransaction,
		addTransfer,
	} = useLedger();
	const { hideIncome } = usePreferences();

	const [type, setType] = useState<TxType>(existing?.type ?? initialType);
	const [amountText, setAmountText] = useState(
		existing ? String(existing.amount) : "",
	);
	const [unit, setUnit] = useState(existing?.unit ?? defaultUnit);
	const [method, setMethod] = useState<PayMethod>(
		existing?.method ?? DEFAULT_METHOD,
	);
	const [categoryId, setCategoryId] = useState<string | null>(
		existing?.categoryId ?? null,
	);
	const [subcategoryId, setSubcategoryId] = useState<string | null>(
		existing?.subcategoryId ?? null,
	);
	const [description, setDescription] = useState(existing?.description ?? "");
	const [date, setDate] = useState(existing?.date ?? todayISO());
	const [walletId, setWalletId] = useState<string | null>(existing?.walletId ?? null);
	// Once the wallet has been set by hand, changing the category stops moving
	// it: the override was a deliberate "this one comes from somewhere else".
	const [walletTouched, setWalletTouched] = useState(!!existing?.walletId);
	const [coverOpen, setCoverOpen] = useState(false);
	// Errors only appear once the user has tried to save — a form that turns red
	// while it's still being filled in is nagging, not helping.
	const [submitted, setSubmitted] = useState(false);

	const typeCategories = useMemo(
		() => categories.filter((c) => c.type === type),
		[categories, type],
	);
	const category = typeCategories.find((c) => c.id === categoryId) ?? null;

	const amount = parseAmount(amountText);
	const amountError =
		!amountText.trim()
			? "Summani kiriting"
			: !Number.isFinite(amount) || amount <= 0
				? "Summa noldan katta bo'lishi kerak"
				: undefined;
	const categoryError = categoryId ? undefined : "Kategoriyani tanlang";

	// The entry being edited is left out, so an expense is measured against the
	// balance without its own older version still subtracted from it.
	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, unit, existing?.id),
		[transactions, transfers, wallets, unit, existing?.id],
	);

	const available = walletId
		? (balances.find((b) => b.walletId === walletId)?.balance ?? 0)
		: 0;
	const shortfall =
		type === "expense" && walletId && Number.isFinite(amount) && amount > available
			? amount - available
			: 0;

	// Nothing that feeds the split has been touched, so the entry keeps the
	// division it was saved with.
	const splitUnchanged =
		!!existing &&
		existing.type === type &&
		existing.amount === amount &&
		existing.unit === unit &&
		existing.categoryId === categoryId;

	// The stored split for an entry as it stands, and the split it is about to
	// get once an edit is saved — history shows what actually happened, the form
	// shows what saving would make happen.
	const preview = useMemo(() => {
		if (splitUnchanged && existing.allocations.length > 0) return existing.allocations;
		if (type !== "income" || !splitsIncome(category)) return [];
		if (!Number.isFinite(amount) || amount <= 0) return [];
		return splitAmount(amount, unit, wallets);
	}, [splitUnchanged, existing, type, category, amount, unit, wallets]);

	// Only surfaced as quick-pick chips once there's an actual choice to make —
	// a category mapped to none or one wallet is already handled by the
	// WalletPicker's own default.
	const mappedWallets = useMemo(
		() => wallets.filter((w) => category?.walletIds?.includes(w.id)),
		[wallets, category],
	);

	const changeType = (next: TxType) => {
		if (next === type) return;
		setType(next);
		// Categories belong to one side of the ledger, so the current pick can't
		// survive the switch.
		setCategoryId(null);
		setSubcategoryId(null);
		setWalletId(null);
		setWalletTouched(false);
	};

	const changeCategory = (next: string | null) => {
		setCategoryId(next);
		setSubcategoryId(null);
		if (walletTouched) return;
		const mappedIds = categories.find((c) => c.id === next)?.walletIds ?? [];
		// Auto-fill only when the category leaves no doubt about which wallet
		// pays; with more than one candidate the quick-pick chips below decide.
		setWalletId(mappedIds.length === 1 ? mappedIds[0] : null);
	};

	const commit = () => {
		if (!categoryId) return;
		const input = {
			type,
			amount,
			unit,
			method,
			categoryId,
			subcategoryId,
			description: description.trim(),
			date,
			// Only an expense is paid out of a wallet; an income is divided into
			// all of them, which the store works out from the category.
			walletId: type === "expense" ? walletId : null,
		};

		if (existing) updateTransaction(existing.id, input);
		else addTransaction(input);
		router.back();
	};

	const save = () => {
		setSubmitted(true);
		if (amountError || !categoryId) return;

		// Spending money a jar doesn't hold is the one thing this form won't
		// record silently. The way through is to name the wallet that is really
		// paying, which keeps both balances true instead of hiding the overspend.
		if (shortfall > 0) {
			Alert.alert(
				`"${walletName(wallets, walletId)}" hamyonida yetarli mablag' yo'q`,
				`Qoldiq: ${formatAmount(available, unit)}\nKerak: ${formatAmount(amount, unit)}\nYetishmaydi: ${formatAmount(shortfall, unit)}\n\nBoshqa hamyondan qoplasangiz, yozuv saqlanadi.`,
				[
					{ text: "Bekor qilish", style: "cancel" },
					{
						text: "Boshqa hamyondan qoplash",
						onPress: () => setCoverOpen(true),
					},
				],
			);
			return;
		}

		commit();
	};

	const confirmDelete = () => {
		if (!existing) return;
		Alert.alert(
			"Yozuv o'chirilsinmi?",
			`${formatAmount(existing.amount, existing.unit)} · ${formatDayLabel(existing.date)}. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => {
						deleteTransaction(existing.id);
						router.back();
					},
				},
			],
		);
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: existing
						? type === "income"
							? "Kirimni tahrirlash"
							: "Chiqimni tahrirlash"
						: type === "income"
							? "Yangi kirim"
							: "Yangi chiqim",
				}}
			/>
			<ScrollView
				className="flex-1 bg-background"
				// Shrinking the scroll viewport, rather than only padding its
				// content, is what lets a field tapped low in the form scroll itself
				// into view: the native scroll container pulls a newly focused child
				// inside its own bounds. The root layout already pads past the
				// navigation bar, so only the rest of the keyboard is taken off here.
				style={{ marginBottom: Math.max(keyboardInset - insets.bottom, 0) }}
				contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Which side of the ledger ------------------------------------ */}
				<View className="flex-row gap-3">
					{(["expense", "income"] as TxType[]).map((option) => {
						const active = type === option;
						const income = option === "income";
						return (
							<Pressable
								key={option}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								onPress={() => changeType(option)}
								className={`flex-1 flex-row items-center justify-center gap-2 rounded-xl py-3.5 active:opacity-70 ${
									active ? "" : "bg-card"
								}`}
								style={
									active
										? { backgroundColor: income ? tc.success : tc.danger }
										: { borderWidth: 1, borderColor: tc.border }
								}
							>
								<Ionicons
									name={income ? "arrow-down-circle" : "arrow-up-circle"}
									size={18}
									color={active ? "#fff" : income ? tc.success : tc.danger}
								/>
								<Text
									className="font-semibold"
									style={{
										fontSize: tf.base,
										color: active ? "#fff" : tc.foreground,
									}}
								>
									{income ? "Kirim" : "Chiqim"}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{/* Amount and unit --------------------------------------------- */}
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
							error={submitted ? amountError : undefined}
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
							options={UNITS.map((u) => ({
								key: u.code,
								label: `${u.code} — ${u.name}`,
							}))}
							trigger={({ open }) => (
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`Valyuta: ${unit}`}
									onPress={open}
									className="flex-row items-center justify-between rounded-xl px-4 active:opacity-70"
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
							)}
						/>
					</View>
				</View>
				{!amountError && (
					<Text className="text-muted-foreground -mt-3" style={{ fontSize: tf.sm }}>
						{type === "income" ? "+" : "−"}
						{formatAmount(amount, unit)} · {unitByCode(unit).name}
					</Text>
				)}

				{/* How it was paid ---------------------------------------------- */}
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

				{/* Category ----------------------------------------------------- */}
				<View>
					<Text
						className="font-medium text-foreground mb-1.5"
						style={{ fontSize: tf.base }}
					>
						Kategoriya
						<Text className="text-danger"> *</Text>
					</Text>
					<Select
						label="Kategoriya"
						value={categoryId}
						toggleOff={false}
						onChange={changeCategory}
						options={typeCategories.map((c) => ({ key: c.id, label: c.name }))}
						emptyMessage={`Hali ${type === "income" ? "kirim" : "chiqim"} kategoriyasi yo'q — avval qo'shing.`}
						headerRight={
							<Pressable
								accessibilityRole="button"
								onPress={() => router.push("/categories")}
								className="px-3 py-1.5 rounded-full bg-muted active:opacity-70"
							>
								<Text
									className="font-medium text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									Boshqarish
								</Text>
							</Pressable>
						}
						renderOption={(option, selected) => {
							const optionCategory = typeCategories.find((c) => c.id === option.key);
							return (
								<View className="flex-row items-center gap-3 py-2.5">
									<CategoryAvatar
										icon={optionCategory?.icon ?? "pricetag-outline"}
										color={optionCategory?.color ?? "blue"}
										size={34}
									/>
									<Text
										className={`flex-1 ${selected ? "font-bold text-primary" : "text-foreground"}`}
										style={{ fontSize: tf.base }}
									>
										{option.label}
									</Text>
									{selected && (
										<Ionicons name="checkmark" size={20} color={tc.primary} />
									)}
								</View>
							);
						}}
						trigger={({ open }) => (
							<Pressable
								accessibilityRole="button"
								onPress={open}
								className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-70"
								style={{
									backgroundColor: tc.card,
									borderWidth: submitted && categoryError ? 1.5 : 1,
									borderColor:
										submitted && categoryError ? tc.danger : tc.border,
									minHeight: 56,
								}}
							>
								{category ? (
									<CategoryAvatar icon={category.icon} color={category.color} size={34} />
								) : (
									<Ionicons
										name="pricetag-outline"
										size={20}
										color={tc.mutedForeground}
									/>
								)}
								<Text
									className="flex-1"
									style={{
										fontSize: tf.lg,
										color: category ? tc.foreground : tc.placeholder,
									}}
									numberOfLines={1}
								>
									{category?.name ?? "Kategoriyani tanlang"}
								</Text>
								<Ionicons name="chevron-down" size={16} color={tc.mutedForeground} />
							</Pressable>
						)}
					/>
					{submitted && !!categoryError && (
						<Text className="text-danger mt-1.5" style={{ fontSize: tf.sm }}>
							{categoryError}
						</Text>
					)}
				</View>

				{/* Subcategory -------------------------------------------------- */}
				<View>
					<Text
						className="font-medium text-foreground mb-1.5"
						style={{ fontSize: tf.base }}
					>
						Ichki kategoriya
					</Text>
					<Select
						label="Ichki kategoriya"
						value={subcategoryId}
						onChange={setSubcategoryId}
						clearable
						disabled={!category || category.subcategories.length === 0}
						options={(category?.subcategories ?? []).map((s) => ({
							key: s.id,
							label: s.name,
						}))}
						emptyMessage="Bu kategoriyada hali ichki kategoriya yo'q."
						trigger={({ open }) => {
							const subcategory =
								category?.subcategories.find((s) => s.id === subcategoryId) ?? null;
							const disabled = !category || category.subcategories.length === 0;
							return (
								<Pressable
									accessibilityRole="button"
									disabled={disabled}
									onPress={open}
									className={`flex-row items-center gap-3 rounded-xl px-4 active:opacity-70 ${
										disabled ? "opacity-50" : ""
									}`}
									style={{
										backgroundColor: tc.card,
										borderWidth: 1,
										borderColor: tc.border,
										minHeight: 56,
									}}
								>
									{subcategory && (
										<View
											style={{
												width: 10,
												height: 10,
												borderRadius: 5,
												backgroundColor: tc.primary,
											}}
										/>
									)}
									<Text
										className="flex-1"
										style={{
											fontSize: tf.lg,
											color: subcategory ? tc.foreground : tc.placeholder,
										}}
										numberOfLines={1}
									>
										{subcategory?.name ??
											(category
												? category.subcategories.length
													? "Ixtiyoriy"
													: "Ichki kategoriya yo'q"
												: "Avval kategoriyani tanlang")}
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

				{/* Which wallet pays, or how the income divides ------------------ */}
				{type === "expense" ? (
					<View>
						{mappedWallets.length > 1 && (
							<View className="flex-row flex-wrap gap-2 mb-2">
								{mappedWallets.map((w) => {
									const active = walletId === w.id;
									return (
										<Pressable
											key={w.id}
											accessibilityRole="button"
											accessibilityState={{ selected: active }}
											onPress={() => {
												setWalletId(w.id);
												setWalletTouched(true);
											}}
											className={`flex-row items-center gap-1.5 rounded-full px-3 py-1.5 active:opacity-70 ${
												active ? "bg-primary-highlight" : "bg-muted"
											}`}
										>
											<View
												style={{
													width: 7,
													height: 7,
													borderRadius: 3.5,
													backgroundColor: categoryColorValue(w.color, isDark),
												}}
											/>
											<Text
												className={`font-medium ${
													active ? "text-primary" : "text-muted-foreground"
												}`}
												style={{ fontSize: tf.sm }}
											>
												{w.name}
											</Text>
										</Pressable>
									);
								})}
							</View>
						)}
						<WalletPicker
							label="Qaysi hamyondan"
							value={walletId}
							onChange={(next) => {
								setWalletId(next);
								setWalletTouched(true);
							}}
							wallets={wallets}
							balances={balances}
							unit={unit}
							allowNone
							includeUnallocated
							hideAmounts={hideIncome}
						/>
						{shortfall > 0 ? (
							<Text className="text-danger mt-1.5" style={{ fontSize: tf.sm }}>
								{`Yetishmaydi: ${formatAmount(shortfall, unit)} — saqlashda boshqa hamyondan qoplashni taklif qilamiz.`}
							</Text>
						) : walletId ? (
							<Text
								className="text-muted-foreground mt-1.5"
								style={{ fontSize: tf.sm }}
							>
								{`Yozuvdan keyin qoladi: ${
									hideIncome
										? maskAmount(unit)
										: formatAmount(
												available - (Number.isFinite(amount) ? amount : 0),
												unit,
											)
								}`}
							</Text>
						) : null}
					</View>
				) : preview.length > 0 ? (
					<View>
						<Text
							className="font-medium text-foreground mb-1.5"
							style={{ fontSize: tf.base }}
						>
							{splitUnchanged ? "Hamyonlarga taqsimlangan" : "Hamyonlarga taqsimlanadi"}
						</Text>
						<View
							className="rounded-xl px-4 py-3 gap-2"
							style={{
								backgroundColor: tc.card,
								borderWidth: 1,
								borderColor: tc.border,
							}}
						>
							{preview.map((allocation) => {
								const share = amount > 0 ? allocation.amount / amount : 0;
								return (
									<View
										key={allocation.walletId}
										className="flex-row items-center gap-2"
									>
										<View
											style={{
												width: 8,
												height: 8,
												borderRadius: 4,
												backgroundColor: categoryColorValue(
													walletColor(wallets, allocation.walletId),
													isDark,
												),
											}}
										/>
										<Text
											className="flex-1 text-foreground"
											style={{ fontSize: tf.sm }}
											numberOfLines={1}
										>
											{walletName(wallets, allocation.walletId)}
										</Text>
										<Text
											className="text-muted-foreground"
											style={{ fontSize: tf.sm }}
										>
											{Math.round(share * 100)}%
										</Text>
										<Text
											className="font-semibold text-foreground text-right"
											style={{ fontSize: tf.sm, minWidth: 96 }}
											numberOfLines={1}
										>
											{hideIncome
												? maskAmount(unit)
												: formatAmount(allocation.amount, unit)}
										</Text>
									</View>
								);
							})}
						</View>
					</View>
				) : null}

				{/* Description and date ----------------------------------------- */}
				<Textarea
					label="Izoh"
					rows={3}
					value={description}
					onChangeText={setDescription}
					placeholder="Nima uchun?"
				/>

				<DateField label="Sana" required value={date} onChange={setDate} maxDate={todayISO()} />

				<View className="gap-3 mt-2">
					<Button
						label={existing ? "O'zgarishlarni saqlash" : "Qo'shish"}
						fullWidth
						size="lg"
						onPress={save}
						startIcon={
							<Ionicons
								name={existing ? "checkmark" : "add"}
								size={18}
								color="#fff"
							/>
						}
					/>
					{existing ? (
						<Button
							label="O'chirish"
							variant="soft"
							color="danger"
							fullWidth
							onPress={confirmDelete}
							startIcon={
								<Ionicons name="trash-outline" size={16} color={tc.danger} />
							}
						/>
					) : null}
				</View>
			</ScrollView>

			{/* Covering a shortfall: the transfer lands first, then the expense it
			    was opened for — so the entry is never saved against a balance that
			    still can't carry it. */}
			<TransferSheet
				key={coverOpen ? "cover-open" : "cover-closed"}
				visible={coverOpen}
				onClose={() => setCoverOpen(false)}
				onSubmit={(input) => {
					setCoverOpen(false);
					addTransfer(input);
					commit();
				}}
				wallets={wallets}
				balances={balances}
				unit={unit}
				title="Yetishmagan summani qoplash"
				description={`"${walletName(wallets, walletId)}" hamyoniga boshqa hamyondan pul o'tkaziladi, so'ng yozuv saqlanadi.`}
				initialToWalletId={walletId}
				initialAmount={shortfall}
				submitLabel="Qoplash va saqlash"
			/>
		</>
	);
}
