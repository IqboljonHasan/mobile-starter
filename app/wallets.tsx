import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
	Alert,
	Pressable,
	ScrollView,
	Switch,
	Text,
	TextInput,
	View,
} from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import TransferHistory from "@/components/TransferHistory";
import TransferSheet from "@/components/TransferSheet";
import {
	BottomSheet,
	Button,
	Card,
	ColorPicker,
	IconButton,
	IconPicker,
	InputField,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	type CategoryColor,
	categoryColorValue,
	nextCategoryColor,
} from "@/lib/categoryColors";
import { formatAmount, maskAmount } from "@/lib/money";
import { DEBT_CATEGORY_IDS } from "@/lib/seed";
import {
	UNALLOCATED_NAME,
	unallocatedPercent,
	walletBalances,
	walletUnitsUsed,
} from "@/lib/wallets";
import type { Category, IconName, Wallet } from "@/lib/types";
import "../global.css";

type WalletDraftState = {
	/** Absent when creating. */
	id?: string;
	name: string;
	color: CategoryColor;
	icon: IconName;
	percent: number;
};

/**
 * Where income is divided and expenses are paid from.
 *
 * One screen rather than several because the parts only make sense together:
 * the percentages decide what goes in, the category mappings decide what comes
 * out, and the balances at the top are the result of both. Splitting them up
 * would mean tuning a percentage without seeing what it does.
 */
export default function WalletsScreen() {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const { hideIncome, toggleHideIncome } = usePreferences();
	const {
		wallets,
		categories,
		transactions,
		transfers,
		defaultUnit,
		addWallet,
		updateWallet,
		deleteWallet,
		updateCategory,
		addTransfer,
		deleteTransfer,
		redistributeHistory,
	} = useLedger();

	const [pickedUnit, setPickedUnit] = useState<string | null>(null);
	const [draft, setDraft] = useState<WalletDraftState | null>(null);
	const [transferOpen, setTransferOpen] = useState(false);
	/** Expense category whose wallet set is being edited, by id. */
	const [walletMapCategoryId, setWalletMapCategoryId] = useState<string | null>(null);

	// Balances are all-time and per unit, so the screen reports one unit at a
	// time exactly as the dashboard does.
	const units = useMemo(() => {
		const used = walletUnitsUsed(transactions, transfers);
		return used.length > 0 ? used : [defaultUnit];
	}, [transactions, transfers, defaultUnit]);
	const unit =
		pickedUnit && units.includes(pickedUnit)
			? pickedUnit
			: units.includes(defaultUnit)
				? defaultUnit
				: units[0];

	const unitTransfers = useMemo(
		() => transfers.filter((t) => t.unit === unit),
		[transfers, unit],
	);

	const balances = useMemo(
		() => walletBalances(transactions, transfers, wallets, unit),
		[transactions, transfers, wallets, unit],
	);

	const remainder = unallocatedPercent(wallets);
	const claimed = 100 - remainder;

	// Bars are read against the largest jar, so the tallest is always full and
	// the rest stay honestly proportional to it.
	const peak = Math.max(...balances.map((b) => Math.abs(b.balance)), 1);

	const expenseCategories = useMemo(
		() => categories.filter((c) => c.type === "expense"),
		[categories],
	);
	const incomeCategories = useMemo(
		() => categories.filter((c) => c.type === "income"),
		[categories],
	);

	// Read back out of the categories list rather than held as its own object,
	// so the sheet reflects a toggle the moment it lands in the store.
	const walletMapCategory = walletMapCategoryId
		? (expenseCategories.find((c) => c.id === walletMapCategoryId) ?? null)
		: null;

	const money = (amount: number) =>
		hideIncome ? maskAmount(unit) : formatAmount(amount, unit);

	const toggleCategoryWallet = (category: Category, walletId: string) => {
		const current = category.walletIds ?? [];
		const next = current.includes(walletId)
			? current.filter((id) => id !== walletId)
			: [...current, walletId];
		updateCategory(category.id, { walletIds: next });
	};

	const openNewWallet = () => {
		setDraft({
			name: "",
			color: nextCategoryColor(wallets.map((w) => w.color)),
			icon: "wallet-outline",
			percent: Math.min(remainder, 10),
		});
	};

	const saveWallet = () => {
		if (!draft) return;
		const name = draft.name.trim();
		if (!name) return;

		// The other wallets' shares are fixed, so this one can only claim what is
		// actually left — a set totalling over 100 would divide money twice.
		const others = wallets
			.filter((w) => w.id !== draft.id)
			.reduce((acc, w) => acc + w.percent, 0);
		const percent = Math.min(Math.max(draft.percent, 0), 100 - others);

		if (draft.id) {
			updateWallet(draft.id, {
				name,
				color: draft.color,
				icon: draft.icon,
				percent,
			});
		} else {
			addWallet({ name, color: draft.color, icon: draft.icon, percent });
		}
		setDraft(null);
	};

	const confirmDeleteWallet = (wallet: Wallet) => {
		const used = categories.filter((c) => c.walletIds?.includes(wallet.id)).length;
		Alert.alert(
			`"${wallet.name}" o'chirilsinmi?`,
			`Bu hamyonga tushgan o'tgan summalar "${UNALLOCATED_NAME}" ga o'tadi.` +
				(used > 0
					? ` ${used} ta kategoriya hamyonsiz qoladi va ularning chiqimi tekshirilmaydi.`
					: ""),
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteWallet(wallet.id),
				},
			],
		);
	};

	const confirmRedistribute = () => {
		Alert.alert(
			"Tarix qayta taqsimlansinmi?",
			`Barcha ${transactions.length} ta yozuv hozirgi foizlar va kategoriya biriktirmalari bo'yicha qaytadan hisoblanadi. Alohida yozuvlarda qo'lda tanlangan hamyonlar ham kategoriyanikiga qaytariladi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{ text: "Qayta taqsimlash", onPress: redistributeHistory },
			],
		);
	};

	const setPercent = (wallet: Wallet, text: string) => {
		const parsed = Number.parseInt(text.replace(/[^\d]/g, ""), 10);
		const others = wallets
			.filter((w) => w.id !== wallet.id)
			.reduce((acc, w) => acc + w.percent, 0);
		const next = Number.isFinite(parsed)
			? Math.min(Math.max(parsed, 0), 100 - others)
			: 0;
		updateWallet(wallet.id, { percent: next });
	};

	return (
		<>
			<Stack.Screen
				options={{
					title: "Hamyonlar",
					headerRight: () => (
						<IconButton
							icon={hideIncome ? "eye-off-outline" : "eye-outline"}
							accessibilityLabel={
								hideIncome ? "Summalarni ko'rsatish" : "Summalarni yashirish"
							}
							onPress={toggleHideIncome}
						/>
					),
				}}
			/>
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Balances ------------------------------------------------------ */}
				<Card
					title="Hamyon qoldiqlari"
					subtitle="Butun tarix bo'yicha — oy almashganda nolga tushmaydi"
				>
					{units.length > 1 && (
						<View className="flex-row flex-wrap gap-2 mb-3">
							{units.map((code) => {
								const active = code === unit;
								return (
									<Pressable
										key={code}
										accessibilityRole="button"
										accessibilityState={{ selected: active }}
										onPress={() => setPickedUnit(code)}
										className={`px-3 py-1.5 rounded-full active:opacity-70 ${
											active ? "bg-primary-highlight" : "bg-muted"
										}`}
									>
										<Text
											className={`font-semibold ${
												active ? "text-primary" : "text-muted-foreground"
											}`}
											style={{ fontSize: tf.sm }}
										>
											{code}
										</Text>
									</Pressable>
								);
							})}
						</View>
					)}

					{balances.length === 0 ? (
						<Text
							className="text-muted-foreground text-center py-4"
							style={{ fontSize: tf.base }}
						>
							{"Hali hamyon yo'q."}
						</Text>
					) : (
						<View className="gap-3">
							{balances.map((row) => {
								const hex = categoryColorValue(row.color, isDark);
								const width = Math.max((Math.abs(row.balance) / peak) * 100, 2);
								return (
									<View key={row.walletId}>
										<View className="flex-row items-center gap-2">
											<View
												style={{
													width: 10,
													height: 10,
													borderRadius: 5,
													backgroundColor: hex,
												}}
											/>
											<Text
												className="flex-1 font-medium text-foreground"
												style={{ fontSize: tf.base }}
												numberOfLines={1}
											>
												{row.name}
											</Text>
											<Text
												className={`font-semibold ${
													row.balance < 0 ? "text-danger" : "text-foreground"
												}`}
												style={{ fontSize: tf.base }}
												numberOfLines={1}
											>
												{money(row.balance)}
											</Text>
										</View>
										<View
											className="rounded-full bg-muted overflow-hidden mt-1.5"
											style={{ height: 8 }}
										>
											<View
												style={{
													width: `${width}%`,
													height: 8,
													borderRadius: 4,
													backgroundColor: row.balance < 0 ? tc.danger : hex,
												}}
											/>
										</View>
									</View>
								);
							})}
						</View>
					)}

					<View className="flex-row gap-3 mt-4">
						<View className="flex-1">
							<Button
								label="Pul o'tkazish"
								variant="soft"
								fullWidth
								disabled={wallets.length < 2}
								onPress={() => setTransferOpen(true)}
								startIcon={
									<Ionicons name="swap-horizontal" size={18} color={tc.primary} />
								}
							/>
						</View>
					</View>
				</Card>

				{/* Transfers ------------------------------------------------------ */}
				<Card
					title="O'tkazmalar tarixi"
					subtitle={
						unitTransfers.length > 0
							? `${unitTransfers.length} ta o'tkazma · o'chirish uchun bosing`
							: undefined
					}
				>
					<TransferHistory
						transfers={unitTransfers}
						wallets={wallets}
						money={money}
						onDelete={deleteTransfer}
					/>
				</Card>

				{/* Percentages --------------------------------------------------- */}
				<Card
					title="Kirim taqsimoti"
					subtitle="Har bir kirim shu foizlar bo'yicha bo'linadi"
					headerRight={
						<View
							className="px-3 py-1.5 rounded-full"
							style={{
								backgroundColor:
									claimed === 100 ? tc.primaryHighlight : tc.muted,
							}}
						>
							<Text
								className="font-bold"
								style={{
									fontSize: tf.sm,
									color: claimed === 100 ? tc.primary : tc.mutedForeground,
								}}
							>
								{claimed}%
							</Text>
						</View>
					}
				>
					<View className="gap-2">
						{wallets.map((wallet) => (
							<View key={wallet.id} className="flex-row items-center gap-3">
								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`${wallet.name} — tahrirlash`}
									onPress={() =>
										setDraft({
											id: wallet.id,
											name: wallet.name,
											color: wallet.color,
											icon: wallet.icon,
											percent: wallet.percent,
										})
									}
									className="flex-1 flex-row items-center gap-3 active:opacity-60"
								>
									<CategoryAvatar icon={wallet.icon} color={wallet.color} size={36} />
									<View className="flex-1">
										<Text
											className="font-medium text-foreground"
											style={{ fontSize: tf.base }}
											numberOfLines={1}
										>
											{wallet.name}
										</Text>
										<Text
											className="text-muted-foreground"
											style={{ fontSize: tf.xs }}
											numberOfLines={1}
										>
											{
												expenseCategories.filter((c) => c.walletIds?.includes(wallet.id))
													.length
											}{" "}
											ta chiqim kategoriyasi
										</Text>
									</View>
								</Pressable>

								<View
									className="flex-row items-center rounded-xl px-3"
									style={{
										backgroundColor: tc.input,
										borderWidth: 1,
										borderColor: tc.border,
										minHeight: 44,
										width: 86,
									}}
								>
									<TextInput
										className="flex-1"
										style={{ color: tc.foreground, fontSize: tf.lg, textAlign: "right" }}
										value={String(wallet.percent)}
										onChangeText={(text) => setPercent(wallet, text)}
										keyboardType="number-pad"
										inputMode="numeric"
										maxLength={3}
										selectTextOnFocus
										accessibilityLabel={`${wallet.name} foizi`}
									/>
									<Text
										className="text-muted-foreground pl-1"
										style={{ fontSize: tf.base }}
									>
										%
									</Text>
								</View>

								<Pressable
									accessibilityRole="button"
									accessibilityLabel={`${wallet.name} — o'chirish`}
									onPress={() => confirmDeleteWallet(wallet)}
									hitSlop={6}
									className="w-9 h-9 items-center justify-center rounded-full active:opacity-60"
								>
									<Ionicons name="trash-outline" size={18} color={tc.danger} />
								</Pressable>
							</View>
						))}
					</View>

					{remainder > 0 && (
						<View
							className="flex-row items-center gap-3 mt-3 pt-3"
							style={{ borderTopWidth: 1, borderTopColor: tc.border }}
						>
							<View className="w-9 h-9 rounded-full items-center justify-center bg-muted">
								<Ionicons
									name="help-circle-outline"
									size={18}
									color={tc.mutedForeground}
								/>
							</View>
							<View className="flex-1">
								<Text
									className="font-medium text-foreground"
									style={{ fontSize: tf.base }}
								>
									{UNALLOCATED_NAME}
								</Text>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.xs }}
								>
									{"Hech bir hamyon olmagan ulush shu yerda to'planadi"}
								</Text>
							</View>
							<Text
								className="font-bold text-muted-foreground"
								style={{ fontSize: tf.lg }}
							>
								{remainder}%
							</Text>
						</View>
					)}

					<View className="mt-4">
						<Button
							label="Yangi hamyon"
							variant="soft"
							fullWidth
							onPress={openNewWallet}
							startIcon={<Ionicons name="add" size={18} color={tc.primary} />}
						/>
					</View>
				</Card>

				{/* Expense mapping ------------------------------------------------ */}
				<Card
					title="Chiqim kategoriyalari"
					subtitle="Har bir kategoriya bitta yoki bir nechta hamyondan to'lanishi mumkin"
				>
					<View className="gap-2">
						{expenseCategories.map((category) => {
							const mapped = wallets.filter((w) => category.walletIds?.includes(w.id));
							return (
								<Pressable
									key={category.id}
									accessibilityRole="button"
									accessibilityLabel={`${category.name} — hamyonlar: ${
										mapped.length ? mapped.map((w) => w.name).join(", ") : "yo'q"
									}`}
									onPress={() => setWalletMapCategoryId(category.id)}
									className="flex-row items-center gap-3 active:opacity-60"
								>
									<CategoryAvatar
										icon={category.icon}
										color={category.color}
										size={34}
									/>
									<Text
										className="flex-1 text-foreground"
										style={{ fontSize: tf.base }}
										numberOfLines={1}
									>
										{category.name}
									</Text>
									<View
										className="flex-row items-center gap-1.5 rounded-full px-3 py-2 bg-muted"
										style={{ maxWidth: 160 }}
									>
										{mapped.length > 0 && (
											<View className="flex-row">
												{mapped.slice(0, 3).map((w, i) => (
													<View
														key={w.id}
														style={{
															width: 8,
															height: 8,
															borderRadius: 4,
															marginLeft: i > 0 ? -3 : 0,
															borderWidth: mapped.length > 1 ? 1.5 : 0,
															borderColor: tc.muted,
															backgroundColor: categoryColorValue(
																w.color,
																isDark,
															),
														}}
													/>
												))}
											</View>
										)}
										<Text
											className={`font-medium ${
												mapped.length > 0 ? "text-foreground" : "text-muted-foreground"
											}`}
											style={{ fontSize: tf.sm }}
											numberOfLines={1}
										>
											{mapped.length === 0
												? "Hamyonsiz"
												: mapped.length === 1
													? mapped[0].name
													: `${mapped.length} ta hamyon`}
										</Text>
										<Ionicons
											name="chevron-down"
											size={12}
											color={tc.mutedForeground}
										/>
									</View>
								</Pressable>
							);
						})}
					</View>
					<Text
						className="text-muted-foreground mt-3"
						style={{ fontSize: tf.xs }}
					>
						{
							"Bir nechta hamyon tanlansa, har bir yozuvda qaysi birisi to'laganini o'zingiz belgilaysiz. Hamyonsiz kategoriyalarning chiqimi hech qaysi hamyondan yechilmaydi va qoldiq yetmasa ham to'silmaydi."
						}
					</Text>
				</Card>

				{/* Income split toggles ------------------------------------------- */}
				<Card
					title="Kirim kategoriyalari"
					subtitle="Qaysi kirimlar hamyonlarga bo'linadi"
				>
					<View className="gap-1">
						{incomeCategories.map((category) => {
							const isDebt = DEBT_CATEGORY_IDS.has(category.id);
							return (
								<View key={category.id} className="flex-row items-center gap-3 py-1">
									<CategoryAvatar
										icon={category.icon}
										color={category.color}
										size={34}
									/>
									<View className="flex-1">
										<Text
											className="text-foreground"
											style={{ fontSize: tf.base }}
											numberOfLines={1}
										>
											{category.name}
										</Text>
										{isDebt && (
											<Text
												className="text-muted-foreground"
												style={{ fontSize: tf.xs }}
												numberOfLines={1}
											>
												{"Qarz — bo'linmaydi"}
											</Text>
										)}
									</View>
									<Switch
										value={!isDebt && category.splitIncome !== false}
										disabled={isDebt}
										onValueChange={(next) =>
											updateCategory(category.id, { splitIncome: next })
										}
										trackColor={{ false: tc.muted, true: tc.primary }}
										thumbColor="#fff"
									/>
								</View>
							);
						})}
					</View>
					<Text
						className="text-muted-foreground mt-3"
						style={{ fontSize: tf.xs }}
					>
						{`O'chirilgan kategoriyalarning puli "${UNALLOCATED_NAME}" ga tushadi.`}
					</Text>
				</Card>

				{/* History -------------------------------------------------------- */}
				<Card
					title="Tarix"
					subtitle="Foizlarni o'zgartirdingizmi? O'tgan yozuvlar eski taqsimotda qoladi."
				>
					<Button
						label="Tarixni qayta taqsimlash"
						variant="soft"
						color="secondary"
						fullWidth
						onPress={confirmRedistribute}
						startIcon={<Ionicons name="refresh" size={18} color={tc.foreground} />}
					/>
				</Card>
			</ScrollView>

			{/* Transfer -------------------------------------------------------- */}
			<TransferSheet
				key={transferOpen ? "transfer-open" : "transfer-closed"}
				visible={transferOpen}
				onClose={() => setTransferOpen(false)}
				onSubmit={addTransfer}
				wallets={wallets}
				balances={balances}
				unit={unit}
			/>

			{/* Category → wallet mapping ----------------------------------------- */}
			<BottomSheet
				visible={!!walletMapCategory}
				onClose={() => setWalletMapCategoryId(null)}
				maxHeight="75%"
			>
				{walletMapCategory && (
					<View className="px-4 pb-2">
						<View className="flex-row items-center gap-3 mb-1">
							<CategoryAvatar
								icon={walletMapCategory.icon}
								color={walletMapCategory.color}
								size={34}
							/>
							<Text
								className="font-bold text-foreground flex-1"
								style={{ fontSize: tf.lg }}
								numberOfLines={1}
							>
								{walletMapCategory.name}
							</Text>
						</View>
						<Text
							className="text-muted-foreground mb-3"
							style={{ fontSize: tf.sm }}
						>
							{
								"Bu kategoriya qaysi hamyon(lar)dan to'lanishi mumkinligini tanlang."
							}
						</Text>
						<ScrollView
							contentContainerStyle={{ paddingBottom: 8 }}
							showsVerticalScrollIndicator={false}
						>
							{wallets.length === 0 ? (
								<Text
									className="text-muted-foreground text-center py-6"
									style={{ fontSize: tf.base }}
								>
									{"Hali hamyon yo'q."}
								</Text>
							) : (
								wallets.map((wallet, i) => {
									const checked =
										walletMapCategory.walletIds?.includes(wallet.id) ?? false;
									return (
										<Pressable
											key={wallet.id}
											accessibilityRole="checkbox"
											accessibilityState={{ checked }}
											onPress={() =>
												toggleCategoryWallet(walletMapCategory, wallet.id)
											}
											className={`flex-row items-center gap-3 py-3 active:opacity-60 ${
												i > 0 ? "border-t border-border" : ""
											}`}
										>
											<CategoryAvatar
												icon={wallet.icon}
												color={wallet.color}
												size={34}
											/>
											<Text
												className="flex-1 text-foreground"
												style={{ fontSize: tf.base }}
												numberOfLines={1}
											>
												{wallet.name}
											</Text>
											<Ionicons
												name={checked ? "checkbox" : "square-outline"}
												size={22}
												color={checked ? tc.primary : tc.mutedForeground}
											/>
										</Pressable>
									);
								})
							)}
						</ScrollView>
					</View>
				)}
			</BottomSheet>

			{/* Wallet editor ---------------------------------------------------- */}
			<BottomSheet visible={!!draft} onClose={() => setDraft(null)} maxHeight="90%">
				{draft && (
					<ScrollView
						contentContainerStyle={{ padding: 16, gap: 16 }}
						keyboardShouldPersistTaps="handled"
					>
						<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
							{draft.id ? "Hamyonni tahrirlash" : "Yangi hamyon"}
						</Text>

						<View className="items-center">
							<CategoryAvatar icon={draft.icon} color={draft.color} size={64} />
						</View>

						<InputField
							label="Nomi"
							required
							value={draft.name}
							onChangeText={(name) =>
								setDraft((prev) => (prev ? { ...prev, name } : prev))
							}
							placeholder="masalan, Oilaga"
							autoFocus={!draft.id}
						/>

						<InputField
							label="Ulushi (%)"
							value={String(draft.percent)}
							onChangeText={(text) => {
								const parsed = Number.parseInt(text.replace(/[^\d]/g, ""), 10);
								setDraft((prev) =>
									prev
										? { ...prev, percent: Number.isFinite(parsed) ? parsed : 0 }
										: prev,
								);
							}}
							keyboardType="number-pad"
							inputMode="numeric"
							maxLength={3}
							hint={`Bo'sh ulush: ${
								100 -
								wallets
									.filter((w) => w.id !== draft.id)
									.reduce((acc, w) => acc + w.percent, 0)
							}%`}
						/>

						<ColorPicker
							label="Rang"
							value={draft.color}
							onChange={(color) =>
								setDraft((prev) => (prev ? { ...prev, color } : prev))
							}
						/>

						<IconPicker
							label="Ikonka"
							value={draft.icon}
							tint={categoryColorValue(draft.color, isDark)}
							onChange={(icon) =>
								setDraft((prev) => (prev ? { ...prev, icon } : prev))
							}
						/>

						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Bekor qilish"
									variant="outline"
									color="secondary"
									fullWidth
									onPress={() => setDraft(null)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Saqlash"
									fullWidth
									disabled={!draft.name.trim()}
									onPress={saveWallet}
								/>
							</View>
						</View>
					</ScrollView>
				)}
			</BottomSheet>
		</>
	);
}
