import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AmountCard from "@/components/AmountCard";
import BottomBar, { BOTTOM_BAR_SPACE } from "@/components/BottomBar";
import CategoryAvatar from "@/components/CategoryAvatar";
import TemplateSheet from "@/components/TemplateSheet";
import TransferSheet from "@/components/TransferSheet";
import WalletIcon from "@/components/WalletIcon";
import WalletPicker from "@/components/WalletPicker";
import {
	Button,
	Chip,
	DateField,
	FieldLabel,
	HeaderMenu,
	NumberPad,
	PickerField,
	Select,
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
import { categoryColorValue } from "@/lib/categoryColors";
import { currentMonthKey, formatDayLabel, monthName, todayISO } from "@/lib/date";
import { contactName, DIRECTION_META, remainingAmount } from "@/lib/debts";
import { DEFAULT_METHOD, formatAmount, maskAmount, parseAmount, unitByCode } from "@/lib/money";
import { DEBT_CATEGORY_IDS } from "@/lib/seed";
import {
	splitAmount,
	splitsIncome,
	UNALLOCATED_ID,
	UNALLOCATED_NAME,
	type WalletBalance,
	walletBalances,
	walletById,
	walletName,
} from "@/lib/wallets";
import type {
	Debt,
	PayMethod,
	Transaction,
	TransactionTemplate,
	TxType,
	Wallet,
} from "@/lib/types";
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
	// An entry the Debts screen wrote is the ledger's side of a debt, not a
	// record of its own. Editing it here would let the two disagree — the debt
	// would still say 500 000 while the entry said 300 000 — so this one is read
	// from here and changed there.
	const owningDebt = existing?.debtId
		? (debts.find((d) => d.id === existing.debtId) ?? null)
		: null;

	if (!ready) {
		return (
			<>
				<Stack.Screen options={{ title: "Yozuv" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.foreground} />
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
						className="font-semibold text-muted-foreground text-center"
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
	const { scrolled, scrollProps } = useScrolled();

	const meta = DIRECTION_META[debt.direction];
	const isPrincipal = debt.transactionId === transaction.id;
	const name = contactName(contacts, debt.contactId);
	const income = transaction.type === "income";

	return (
		<>
			<Stack.Screen options={{ title: "Qarz yozuvi" }} />
			<View className="flex-1 bg-background">
				<ScrollView
					{...scrollProps}
					className="flex-1 bg-background"
					contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 32, gap: 12 }}
				>
					<View className="bg-card items-center" style={{ borderRadius: 20, padding: 20 }}>
						<View
							className="items-center justify-center bg-background"
							style={{ width: 52, height: 52, borderRadius: 18 }}
						>
							<Ionicons name="people-outline" size={24} color={tc.foreground} />
						</View>
						<Text
							className="font-extrabold mt-3"
							style={{ fontSize: tf.xxxl + 4, letterSpacing: -0.6, color: income ? tc.success : tc.foreground }}
							numberOfLines={1}
							adjustsFontSizeToFit
						>
							{income ? "+" : "−"}
							{formatAmount(transaction.amount, transaction.unit)}
						</Text>
						<Text
							className="font-semibold text-muted-foreground mt-1 text-center"
							style={{ fontSize: tf.sm + 1 }}
						>
							{`${name} · ${formatDayLabel(transaction.date)}`}
						</Text>
					</View>

					<View className="bg-card gap-1" style={{ borderRadius: 20, padding: 16 }}>
						<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
							{isPrincipal
								? `Bu yozuv "${meta.label}" qarzining o'zi`
								: `Bu yozuv qarz bo'yicha ${meta.payLabel.toLowerCase()}`}
						</Text>
						<Text
							className="font-semibold text-muted-foreground"
							style={{ fontSize: tf.sm, lineHeight: Math.round(tf.sm * 1.45) }}
						>
							{`Summani yoki sanani o'zgartirish uchun qarzning o'zini tahrirlang — aks holda qarz qoldig'i bilan hisob bir-biriga to'g'ri kelmay qoladi. Hozirgi qoldiq: ${formatAmount(remainingAmount(debt), debt.unit)}.`}
						</Text>
					</View>

					<View className="gap-1 mt-2">
						<Button
							label="Qarzni ochish"
							size="lg"
							fullWidth
							startIcon={<Ionicons name="open-outline" size={18} color={tc.primaryFg} />}
							onPress={() => router.replace(`/debt?id=${debt.id}`)}
						/>
						<Button
							label="Orqaga"
							variant="text"
							color="secondary"
							fullWidth
							onPress={() => router.back()}
						/>
					</View>
				</ScrollView>
				<ScrollShadow visible={scrolled} />
			</View>
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
		templates,
		addTemplate,
		deleteTemplate,
		members,
	} = useLedger();
	const { hideIncome, splitIncome } = usePreferences();

	const [type, setType] = useState<TxType>(existing?.type ?? initialType);
	const [amountText, setAmountText] = useState(existing ? String(existing.amount) : "");
	const [unit, setUnit] = useState(existing?.unit ?? defaultUnit);
	const [method, setMethod] = useState<PayMethod>(existing?.method ?? DEFAULT_METHOD);
	const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
	const [subcategoryId, setSubcategoryId] = useState<string | null>(
		existing?.subcategoryId ?? null,
	);
	const [description, setDescription] = useState(existing?.description ?? "");
	const [date, setDate] = useState(existing?.date ?? todayISO());
	// Income side: whether this entry is divided across the wallets. An income
	// that names a wallet is the opt-out — the whole amount goes there instead.
	const [splitThis, setSplitThis] = useState(!existing?.walletId);
	const [incomeWalletId, setIncomeWalletId] = useState<string | null>(
		type === "income" ? (existing?.walletId ?? null) : null,
	);
	// Expense side: who in the family it was spent on. Null is everybody.
	const [memberId, setMemberId] = useState<string | null>(existing?.memberId ?? null);
	// Expense side: a wallet the user picked over the category's own. Tied to the
	// category it was picked under, so choosing another category starts over from
	// that category's wallet instead of carrying the pick across.
	const [pickedWallet, setPickedWallet] = useState<{
		categoryId: string;
		walletId: string | null;
	} | null>(null);
	const [coverOpen, setCoverOpen] = useState(false);
	const [padOpen, setPadOpen] = useState(false);
	const [templateOpen, setTemplateOpen] = useState(false);
	// The template last applied — its chip shows as picked until the form moves on.
	const [templateId, setTemplateId] = useState<string | null>(null);
	const { scrolled: formScrolled, scrollProps: formScrollProps } = useScrolled();
	// Errors only appear once the user has tried to save — a form that turns red
	// while it's still being filled in is nagging, not helping.
	const [submitted, setSubmitted] = useState(false);

	const income = type === "income";
	const typeCategories = useMemo(
		() => categories.filter((c) => c.type === type),
		[categories, type],
	);
	const category = typeCategories.find((c) => c.id === categoryId) ?? null;
	const subcategory = category?.subcategories.find((s) => s.id === subcategoryId) ?? null;

	// An expense starts out paid by the wallet its category is mapped to, and the
	// user can pay it from any other — one wallet can cover many categories. The
	// debt categories ship unmapped and name their wallet themselves, so an entry
	// on one keeps the wallet it already had. An entry being edited keeps its own.
	const walletId = useMemo(() => {
		if (income || !categoryId) return null;
		if (pickedWallet && pickedWallet.categoryId === categoryId) return pickedWallet.walletId;
		const keeps = existing?.type === "expense" && existing.categoryId === categoryId;
		if (keeps && existing.walletId && wallets.some((w) => w.id === existing.walletId)) {
			return existing.walletId;
		}
		if (DEBT_CATEGORY_IDS.has(categoryId)) return keeps ? (existing.walletId ?? null) : null;
		return wallets.find((w) => category?.walletIds?.includes(w.id))?.id ?? null;
	}, [income, categoryId, category, existing, wallets, pickedWallet]);

	const amount = parseAmount(amountText);
	const amountError = !amountText.trim()
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

	// Whether the category (and the user-wide switch) would divide this income
	// on its own; only then is there a split for the entry to opt out of.
	const splitsByDefault = income && splitsIncome(category, splitIncome);
	const dividing = splitsByDefault && splitThis;

	// The stored split for an entry as it stands, and the split it is about to
	// get once an edit is saved — history shows what actually happened, the form
	// shows what saving would make happen.
	const preview = useMemo(() => {
		if (!dividing) return [];
		if (splitUnchanged && existing.allocations.length > 0 && !existing.walletId) {
			return existing.allocations;
		}
		if (!Number.isFinite(amount) || amount <= 0) return [];
		return splitAmount(amount, unit, wallets);
	}, [dividing, splitUnchanged, existing, amount, unit, wallets]);

	// Starred subcategories of this side of the ledger, across every category.
	const pinnedShortcuts = useMemo(
		() =>
			typeCategories.flatMap((c) =>
				c.subcategories.filter((s) => s.pinned).map((s) => ({ category: c, sub: s })),
			),
		[typeCategories],
	);

	// This side's templates whose category still exists — one filed under a
	// deleted category has nothing left to fill the form with.
	const typeTemplates = useMemo(
		() =>
			templates.filter(
				(t) => t.type === type && typeCategories.some((c) => c.id === t.categoryId),
			),
		[templates, type, typeCategories],
	);

	const applyTemplate = (template: TransactionTemplate) => {
		const templateCategory = typeCategories.find((c) => c.id === template.categoryId);
		setTemplateId(template.id);
		if (template.amount !== null) setAmountText(String(template.amount));
		setUnit(template.unit);
		setMethod(template.method);
		setCategoryId(template.categoryId);
		setPickedWallet(null);
		setSubcategoryId(
			templateCategory?.subcategories.some((s) => s.id === template.subcategoryId)
				? template.subcategoryId
				: null,
		);
		setDescription(template.description);
		if (template.type === "expense") {
			setMemberId(
				members.some((m) => m.id === template.memberId) ? (template.memberId ?? null) : null,
			);
		} else {
			setSplitThis(template.split);
			setIncomeWalletId(template.split ? null : template.walletId);
		}
	};

	const confirmDeleteTemplate = (template: TransactionTemplate) => {
		Alert.alert(`"${template.name}" shabloni o'chirilsinmi?`, "Yozilgan yozuvlarga tegmaydi.", [
			{ text: "Bekor qilish", style: "cancel" },
			{
				text: "O'chirish",
				style: "destructive",
				onPress: () => {
					deleteTemplate(template.id);
					if (templateId === template.id) setTemplateId(null);
				},
			},
		]);
	};

	const openTemplateSheet = () => {
		if (!category) {
			Alert.alert("Avval kategoriyani tanlang", "Shablon kategoriyasi bilan saqlanadi.");
			return;
		}
		setTemplateOpen(true);
	};

	const saveTemplate = (name: string, keepAmount: boolean) => {
		if (!categoryId) return;
		const template = addTemplate({
			name,
			type,
			amount: keepAmount && !amountError ? amount : null,
			unit,
			method,
			categoryId,
			subcategoryId,
			description: description.trim(),
			walletId: type === "expense" ? walletId : dividing ? null : incomeWalletId,
			split: type === "income" && dividing,
			memberId: type === "expense" ? memberId : null,
		});
		setTemplateId(template.id);
	};

	// Back to a blank form, as it opened — the date included.
	const clearForm = () => {
		setAmountText("");
		setUnit(defaultUnit);
		setMethod(DEFAULT_METHOD);
		setCategoryId(null);
		setPickedWallet(null);
		setSubcategoryId(null);
		setDescription("");
		setDate(todayISO());
		setSplitThis(true);
		setIncomeWalletId(null);
		setMemberId(null);
		setTemplateId(null);
		setSubmitted(false);
	};

	const changeType = (next: TxType) => {
		if (next === type) return;
		setType(next);
		// Categories belong to one side of the ledger, so the current pick can't
		// survive the switch.
		setCategoryId(null);
		setSubcategoryId(null);
		setIncomeWalletId(null);
		setSplitThis(true);
		setTemplateId(null);
	};

	const changeCategory = (next: string | null) => {
		setCategoryId(next);
		setPickedWallet(null);
		setSubcategoryId(null);
		// Picked by hand, the form is no longer the template it started from.
		setTemplateId(null);
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
			// An expense is paid out of one wallet. An income is divided across
			// all of them, which the store works out from the category — unless
			// it isn't being divided, in which case it names the wallet that
			// receives it whole (or none, and touches no wallet).
			walletId: type === "expense" ? walletId : dividing ? null : incomeWalletId,
			// Money in isn't spent on anybody, so an entry turned into income
			// drops whoever it named.
			memberId: type === "expense" ? memberId : null,
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

	const title = existing
		? income
			? "Kirimni tahrirlash"
			: "Chiqimni tahrirlash"
		: income
			? "Yangi kirim"
			: "Yangi chiqim";
	const keyboardLift = Math.max(keyboardInset - insets.bottom, 0);
	const money = (value: number) => (hideIncome ? maskAmount(unit) : formatAmount(value, unit));

	return (
		<View className="flex-1 bg-background">
			<Stack.Screen
				options={{
					title,
					headerRight: () => (
						<HeaderMenu
							items={[
								{
									key: "template",
									label: "Shablon sifatida saqlash",
									icon: "bookmark-outline",
									onPress: openTemplateSheet,
								},
								{
									key: "type",
									label: income ? "Chiqimga aylantirish" : "Kirimga aylantirish",
									icon: "swap-vertical-outline",
									onPress: () => changeType(income ? "expense" : "income"),
								},
								existing
									? {
											key: "delete",
											label: "Yozuvni o'chirish",
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
							]}
						/>
					),
				}}
			/>
			<ScrollView
				{...formScrollProps}
				className="flex-1"
				// Shrinking the scroll viewport, rather than only padding its
				// content, is what lets a field tapped low in the form scroll itself
				// into view: the native scroll container pulls a newly focused child
				// inside its own bounds. The root layout already pads past the
				// navigation bar, so only the rest of the keyboard is taken off here.
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
				{/* Amount, how it was paid, and in what -------------------------- */}
				<AmountCard
					value={amountText}
					autoFocus={!existing}
					onFocus={() => setPadOpen(true)}
					onBlur={() => setPadOpen(false)}
					method={method}
					onMethodChange={setMethod}
					unit={unit}
					onUnitChange={setUnit}
					error={submitted ? amountError : undefined}
				/>

				{/* Category and subcategory, side by side ------------------------- */}
				<View>
					<View className="flex-row" style={{ gap: 8 }}>
						<View className="flex-1">
							<FieldLabel required>Kategoriya</FieldLabel>
							<Select
								label="Kategoriya"
								value={categoryId}
								toggleOff={false}
								onChange={changeCategory}
								options={typeCategories.map((c) => ({ key: c.id, label: c.name }))}
								emptyMessage={`Hali ${income ? "kirim" : "chiqim"} kategoriyasi yo'q — avval qo'shing.`}
								headerRight={
									<Pressable
										accessibilityRole="button"
										onPress={() => router.push("/categories")}
										className="px-3.5 py-2 rounded-full bg-muted active:opacity-70"
									>
										<Text className="font-bold text-foreground" style={{ fontSize: tf.sm }}>
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
												className={`flex-1 text-foreground ${selected ? "font-extrabold" : "font-semibold"}`}
												style={{ fontSize: tf.base }}
											>
												{option.label}
											</Text>
											{selected && (
												<Ionicons name="checkmark-circle" size={22} color={tc.foreground} />
											)}
										</View>
									);
								}}
								trigger={({ open }) => (
									<PickerField
										accessibilityLabel={`Kategoriya: ${category?.name ?? "tanlanmagan"}`}
										text={category?.name ?? null}
										placeholder="Tanlang"
										onPress={open}
										error={submitted && !!categoryError}
									/>
								)}
							/>
						</View>
						<View className="flex-1">
							<FieldLabel>Subkategoriya</FieldLabel>
							<Select
								label="Subkategoriya"
								value={subcategoryId}
								onChange={setSubcategoryId}
								clearable
								disabled={!category || category.subcategories.length === 0}
								options={(category?.subcategories ?? []).map((s) => ({
									key: s.id,
									label: s.name,
								}))}
								emptyMessage="Bu kategoriyada hali subkategoriya yo'q."
								trigger={({ open }) => (
									<PickerField
										accessibilityLabel={`Subkategoriya: ${subcategory?.name ?? "tanlanmagan"}`}
										text={subcategory?.name ?? null}
										placeholder={
											category
												? category.subcategories.length
													? "Ixtiyoriy"
													: "Yo'q"
												: "Tanlang"
										}
										onPress={open}
										disabled={!category || category.subcategories.length === 0}
									/>
								)}
							/>
						</View>
					</View>
					{submitted && !!categoryError && (
						<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
							{categoryError}
						</Text>
					)}
				</View>

				{/* Templates fill the whole form; pinned subcategories set the
				    category and subcategory. A template is removed by holding it. */}
				{typeTemplates.length + pinnedShortcuts.length > 0 && (
					<ScrollView
						horizontal
						accessibilityRole="radiogroup"
						accessibilityLabel="Tezkor tanlash"
						showsHorizontalScrollIndicator={false}
						keyboardShouldPersistTaps="handled"
						style={{ marginTop: -8, marginHorizontal: -18 }}
						contentContainerStyle={{ gap: 6, paddingHorizontal: 18 }}
					>
						{typeTemplates.map((template) => (
							<Chip
								key={template.id}
								size="sm"
								role="radio"
								leadingIcon="bookmark"
								label={template.name}
								active={templateId === template.id}
								accessibilityLabel={`Shablon: ${template.name}`}
								onPress={() => applyTemplate(template)}
								onLongPress={() => confirmDeleteTemplate(template)}
							/>
						))}
						{pinnedShortcuts.map(({ category: c, sub }) => {
							const selected = categoryId === c.id && subcategoryId === sub.id;
							return (
								<Chip
									key={sub.id}
									size="sm"
									role="radio"
									label={sub.name}
									active={selected}
									onPress={() => {
										if (selected) {
											setSubcategoryId(null);
											return;
										}
										if (categoryId !== c.id) changeCategory(c.id);
										setSubcategoryId(sub.id);
									}}
								/>
							);
						})}
					</ScrollView>
				)}

				{/* Which wallet pays, or how the income divides ------------------ */}
				{type === "expense" ? (
					<View>
						<WalletPicker
							readOnly={!category}
							label="Qaysi hamyondan"
							value={walletId}
							onChange={(next) =>
								categoryId && setPickedWallet({ categoryId, walletId: next })
							}
							allowNone
							wallets={wallets}
							balances={balances}
							unit={unit}
							includeUnallocated
							noneLabel={category ? "Hamyonsiz" : "Avval kategoriyani tanlang"}
							hideAmounts={hideIncome}
						/>
						{shortfall > 0 ? (
							<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
								{`Yetishmaydi: ${formatAmount(shortfall, unit)} — saqlashda boshqa hamyondan qoplashni taklif qilamiz.`}
							</Text>
						) : walletId ? (
							<Text
								className="font-semibold text-muted-foreground mt-1.5 ml-1"
								style={{ fontSize: tf.sm }}
							>
								{`Yozuvdan keyin qoladi: ${money(available - (Number.isFinite(amount) ? amount : 0))}`}
							</Text>
						) : null}
					</View>
				) : category ? (
					<View className="bg-card overflow-hidden" style={{ borderRadius: 20 }}>
						{splitsByDefault && (
							<View
								className="flex-row items-center gap-3"
								style={{ minHeight: 60, paddingLeft: 14, paddingRight: 8 }}
							>
								<View
									className="items-center justify-center bg-background"
									style={{ width: 32, height: 32, borderRadius: 10 }}
								>
									<Ionicons name="pie-chart-outline" size={18} color={tc.foreground} />
								</View>
								<View className="flex-1 gap-px">
									<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
										Hamyonlarga taqsimlash
									</Text>
									<Text
										className="font-semibold text-muted-foreground"
										style={{ fontSize: tf.sm - 1 }}
									>
										{splitThis ? "Ulushlar bo'yicha avtomatik" : "Bitta hamyonga tushadi"}
									</Text>
								</View>
								<Toggle
									value={splitThis}
									onValueChange={setSplitThis}
									accessibilityLabel="Hamyonlarga taqsimlash"
								/>
							</View>
						)}

						{dividing ? (
							preview.length > 0 && (
								<View style={{ paddingHorizontal: 14, paddingBottom: 6 }}>
									{preview.map((allocation) => {
										const wallet = walletById(wallets, allocation.walletId);
										const pool = allocation.walletId === UNALLOCATED_ID;
										const share = amount > 0 ? (allocation.amount / amount) * 100 : 0;
										return (
											<View
												key={allocation.walletId}
												className="flex-row items-center border-t border-border"
												style={{ height: 40, gap: 10 }}
											>
												<WalletIcon
													icon={pool ? null : (wallet?.icon ?? "wallet-outline")}
													color={wallet?.color ?? "blue"}
													size={24}
												/>
												<Text
													className="flex-1 font-semibold text-foreground"
													style={{ fontSize: tf.sm + 1 }}
													numberOfLines={1}
												>
													{pool ? UNALLOCATED_NAME : walletName(wallets, allocation.walletId)}
												</Text>
												<Text
													className="font-bold text-muted-foreground"
													style={{ fontSize: tf.xs + 1 }}
												>
													{`${String(Math.round(share * 10) / 10).replace(".", ",")}%`}
												</Text>
												<Text
													className="font-extrabold text-foreground text-right"
													style={{ fontSize: tf.sm + 1, minWidth: 88 }}
													numberOfLines={1}
												>
													{money(allocation.amount)}
												</Text>
											</View>
										);
									})}
								</View>
							)
						) : (
							<View
								className={splitsByDefault ? "border-t border-border" : ""}
								style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 }}
							>
								<Text
									nativeID="income-wallet-label"
									className="font-bold text-muted-foreground mb-2"
									style={{ fontSize: tf.sm }}
								>
									Qaysi hamyonga
								</Text>
								<IncomeWalletChips
									wallets={wallets}
									balances={balances}
									value={incomeWalletId}
									onChange={setIncomeWalletId}
								/>
							</View>
						)}
					</View>
				) : null}

				{/* Who it was spent on — once there is a family to choose from --- */}
				{type === "expense" && members.length > 0 && (
					<View>
						<FieldLabel>Kimga sarflandi</FieldLabel>
						<ScrollView
							horizontal
							accessibilityRole="radiogroup"
							accessibilityLabel="Kimga sarflandi"
							showsHorizontalScrollIndicator={false}
							keyboardShouldPersistTaps="handled"
							style={{ marginHorizontal: -18 }}
							contentContainerStyle={{ gap: 6, paddingHorizontal: 18 }}
						>
							<Chip
								role="radio"
								label="Umumiy"
								leadingIcon="people-outline"
								active={memberId === null}
								accessibilityLabel="Umumiy — butun oila uchun"
								onPress={() => setMemberId(null)}
							/>
							{members.map((m) => (
								<Chip
									key={m.id}
									role="radio"
									label={m.name}
									dot={categoryColorValue(m.color, isDark)}
									active={memberId === m.id}
									onPress={() => setMemberId(m.id)}
								/>
							))}
						</ScrollView>
					</View>
				)}

				{/* Note and date ------------------------------------------------- */}
				<Textarea
					label="Izoh"
					rows={4}
					value={description}
					onChangeText={setDescription}
					placeholder={
						income
							? `Masalan: ${monthName(currentMonthKey()).toLowerCase()} oyi uchun`
							: "Masalan: haftalik bozorlik"
					}
				/>

				<DateField label="Sana" required value={date} onChange={setDate} maxDate={todayISO()} />
			</ScrollView>
			<ScrollShadow visible={formScrolled} />

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
									? "O'zgarishlarni saqlash"
									: income
										? "Yangi kirim qo'shish"
										: "Yangi chiqim qo'shish"
							}
							size="lg"
							fullWidth
							onPress={save}
						/>
					</View>
				</BottomBar>
			)}

			<TemplateSheet
				key={templateOpen ? "template-open" : "template-closed"}
				visible={templateOpen}
				onClose={() => setTemplateOpen(false)}
				onSubmit={saveTemplate}
				initialName={subcategory?.name ?? category?.name ?? ""}
				summary={[
					[category?.name, subcategory?.name].filter(Boolean).join(" / "),
					amountError ? null : formatAmount(amount, unit),
				]
					.filter(Boolean)
					.join(" · ")}
				hasAmount={!amountError}
			/>

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
		</View>
	);
}

/**
 * Where an income that isn't split lands — every wallet as a chip with its
 * tile, plus "no wallet". The unallocated pool is offered once it holds
 * something, since it's a real balance the user may be topping up.
 */
function IncomeWalletChips({
	wallets,
	balances,
	value,
	onChange,
}: {
	wallets: Wallet[];
	balances: WalletBalance[];
	value: string | null;
	onChange: (walletId: string | null) => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const pool = balances.find((b) => b.walletId === UNALLOCATED_ID && b.balance !== 0);
	const options = [
		{ key: null, name: "Hamyonsiz", icon: null, color: "blue", none: true },
		...wallets.map((w) => ({ key: w.id, name: w.name, icon: w.icon, color: w.color, none: false })),
		...(pool
			? [{ key: UNALLOCATED_ID, name: UNALLOCATED_NAME, icon: null, color: "blue", none: false }]
			: []),
	];

	return (
		<View
			accessibilityRole="radiogroup"
			accessibilityLabelledBy="income-wallet-label"
			className="flex-row flex-wrap"
			style={{ gap: 6 }}
		>
			{options.map((option) => {
				const active = option.key === value;
				return (
					<Pressable
						key={option.key ?? "none"}
						accessibilityRole="radio"
						accessibilityState={{ checked: active }}
						onPress={() => onChange(option.key)}
						className={`flex-row items-center rounded-full active:opacity-70 ${
							active ? "bg-primary" : "bg-background"
						}`}
						style={{ height: 44, paddingLeft: 8, paddingRight: 14, gap: 8 }}
					>
						{option.none ? (
							<View
								className="items-center justify-center bg-muted"
								style={{ width: 28, height: 28, borderRadius: 14 }}
							>
								<Ionicons name="remove" size={16} color={tc.mutedForeground} />
							</View>
						) : (
							<WalletIcon icon={option.icon} color={option.color} size={28} round />
						)}
						<Text
							className={`font-bold ${active ? "text-primary-fg" : "text-foreground"}`}
							style={{ fontSize: tf.sm + 1 }}
						>
							{option.name}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}
