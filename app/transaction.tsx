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
import {
	Button,
	DateField,
	InputField,
	Select,
	Textarea,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/hooks/useTheme";
import { formatDayLabel, todayISO } from "@/lib/date";
import { formatAmount, parseAmount, UNITS, unitByCode } from "@/lib/money";
import type { Transaction, TxType } from "@/lib/types";
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
	const { ready, transactions } = useLedger();

	const existing = params.id ? transactions.find((t) => t.id === params.id) : undefined;

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

function TransactionForm({
	existing,
	initialType,
}: {
	existing?: Transaction;
	initialType: TxType;
}) {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const insets = useSafeAreaInsets();
	const keyboardInset = useKeyboardInset();
	const {
		categories,
		defaultUnit,
		addTransaction,
		updateTransaction,
		deleteTransaction,
	} = useLedger();

	const [type, setType] = useState<TxType>(existing?.type ?? initialType);
	const [amountText, setAmountText] = useState(
		existing ? String(existing.amount) : "",
	);
	const [unit, setUnit] = useState(existing?.unit ?? defaultUnit);
	const [categoryId, setCategoryId] = useState<string | null>(
		existing?.categoryId ?? null,
	);
	const [subcategoryId, setSubcategoryId] = useState<string | null>(
		existing?.subcategoryId ?? null,
	);
	const [description, setDescription] = useState(existing?.description ?? "");
	const [date, setDate] = useState(existing?.date ?? todayISO());
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

	const changeType = (next: TxType) => {
		if (next === type) return;
		setType(next);
		// Categories belong to one side of the ledger, so the current pick can't
		// survive the switch.
		setCategoryId(null);
		setSubcategoryId(null);
	};

	const save = () => {
		setSubmitted(true);
		if (amountError || !categoryId) return;

		const input = {
			type,
			amount,
			unit,
			categoryId,
			subcategoryId,
			description: description.trim(),
			date,
		};

		if (existing) updateTransaction(existing.id, input);
		else addTransaction(input);
		router.back();
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
						onChange={(next) => {
							setCategoryId(next);
							setSubcategoryId(null);
						}}
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
		</>
	);
}
