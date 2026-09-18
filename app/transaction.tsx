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
				<Stack.Screen options={{ title: "Entry" }} />
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.primary} />
				</View>
			</>
		);
	}

	if (params.id && !existing) {
		return (
			<>
				<Stack.Screen options={{ title: "Entry" }} />
				<View className="flex-1 bg-background items-center justify-center px-8">
					<Text
						className="text-muted-foreground text-center"
						style={{ fontSize: tf.base }}
					>
						This entry no longer exists.
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
			? "Enter an amount"
			: !Number.isFinite(amount) || amount <= 0
				? "Amount must be greater than zero"
				: undefined;
	const categoryError = categoryId ? undefined : "Pick a category";

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
			"Delete entry?",
			`${formatAmount(existing.amount, existing.unit)} on ${formatDayLabel(existing.date)}. This can't be undone.`,
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
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
						? `Edit ${type}`
						: type === "income"
							? "New income"
							: "New expense",
				}}
			/>
			<ScrollView
				className="flex-1 bg-background"
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
									{income ? "Income" : "Expense"}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{/* Amount and unit --------------------------------------------- */}
				<View className="flex-row items-start gap-3">
					<View className="flex-1">
						<InputField
							label="Amount"
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
							Unit
						</Text>
						<Select
							label="Unit"
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
									accessibilityLabel={`Unit: ${unit}`}
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
						Category
						<Text className="text-danger"> *</Text>
					</Text>
					<Select
						label="Category"
						value={categoryId}
						toggleOff={false}
						onChange={(next) => {
							setCategoryId(next);
							setSubcategoryId(null);
						}}
						options={typeCategories.map((c) => ({ key: c.id, label: c.name }))}
						emptyMessage={`No ${type} categories yet — add one first.`}
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
									Manage
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
									{category?.name ?? "Choose a category"}
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
						Subcategory
					</Text>
					<Select
						label="Subcategory"
						value={subcategoryId}
						onChange={setSubcategoryId}
						clearable
						disabled={!category || category.subcategories.length === 0}
						options={(category?.subcategories ?? []).map((s) => ({
							key: s.id,
							label: s.name,
						}))}
						emptyMessage="This category has no subcategories yet."
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
													? "Optional"
													: "No subcategories"
												: "Pick a category first")}
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
					label="Description"
					rows={3}
					value={description}
					onChangeText={setDescription}
					placeholder="What was it for?"
				/>

				<DateField label="Date" required value={date} onChange={setDate} maxDate={todayISO()} />

				<View className="gap-3 mt-2">
					<Button
						label={existing ? "Save changes" : "Add entry"}
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
							label="Delete"
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
