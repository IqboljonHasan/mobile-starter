import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
import CategoryReorderList from "@/components/CategoryReorderList";
import {
	BottomSheet,
	Button,
	Card,
	ColorPicker,
	EmptyState,
	IconPicker,
	InputField,
	SegmentedControl,
} from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import {
	type CategoryColor,
	categoryColorValue,
	nextCategoryColor,
	withAlpha,
} from "@/lib/categoryColors";
import { countSubUsage, countUsage } from "@/lib/ledger";
import type { Category, IconName, TxType } from "@/lib/types";
import "../global.css";

type CategoryDraftState = {
	/** Absent when creating. */
	id?: string;
	name: string;
	color: CategoryColor;
	icon: IconName;
};

type SubcategoryDraftState = {
	categoryId: string;
	id?: string;
	name: string;
	color: CategoryColor;
};

/**
 * Create, edit and delete categories and their subcategories.
 *
 * Both editors are bottom sheets rather than pushed screens: they hold three
 * short fields, and keeping the list behind them makes it obvious which
 * category is being changed.
 */
export default function CategoriesScreen() {
	const { tc, isDark } = useTheme();
	const { tf } = useFont();
	const {
		categories,
		transactions,
		addCategory,
		updateCategory,
		deleteCategory,
		reorderCategories,
		addSubcategory,
		updateSubcategory,
		deleteSubcategory,
	} = useLedger();

	const [type, setType] = useState<TxType>("expense");
	const [reordering, setReordering] = useState(false);
	// A drag and a vertical scroll are the same movement, so the list stops
	// scrolling while a row is in hand.
	const [dragging, setDragging] = useState(false);
	const [categoryDraft, setCategoryDraft] = useState<CategoryDraftState | null>(null);
	const [subDraft, setSubDraft] = useState<SubcategoryDraftState | null>(null);

	const visible = useMemo(
		() => categories.filter((c) => c.type === type),
		[categories, type],
	);

	const openNewCategory = () => {
		setCategoryDraft({
			name: "",
			// Start on a hue this side of the ledger isn't using yet, so a new
			// category is distinguishable without the user having to think about it.
			color: nextCategoryColor(visible.map((c) => c.color)),
			icon: "pricetag-outline",
		});
	};

	const openEditCategory = (category: Category) => {
		setCategoryDraft({
			id: category.id,
			name: category.name,
			color: category.color,
			icon: category.icon,
		});
	};

	const saveCategory = () => {
		if (!categoryDraft) return;
		const name = categoryDraft.name.trim();
		if (!name) return;

		if (categoryDraft.id) {
			updateCategory(categoryDraft.id, {
				name,
				color: categoryDraft.color,
				icon: categoryDraft.icon,
			});
		} else {
			addCategory({ type, name, color: categoryDraft.color, icon: categoryDraft.icon });
		}
		setCategoryDraft(null);
	};

	const confirmDeleteCategory = (category: Category) => {
		const used = countUsage(transactions, category.id);
		Alert.alert(
			`"${category.name}" o'chirilsinmi?`,
			used > 0
				? `${used} ta yozuv bu kategoriyada. Ular saqlanadi va "Kategoriyasiz" bo'lib ko'rinadi.`
				: "Ichki kategoriyalari ham o'chiriladi.",
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteCategory(category.id),
				},
			],
		);
	};

	const saveSubcategory = () => {
		if (!subDraft) return;
		const name = subDraft.name.trim();
		if (!name) return;

		if (subDraft.id) {
			updateSubcategory(subDraft.categoryId, subDraft.id, {
				name,
				color: subDraft.color,
			});
		} else {
			addSubcategory(subDraft.categoryId, { name, color: subDraft.color });
		}
		setSubDraft(null);
	};

	const confirmDeleteSubcategory = (category: Category, subcategoryId: string, name: string) => {
		const used = countSubUsage(transactions, subcategoryId);
		Alert.alert(
			`"${name}" o'chirilsinmi?`,
			used > 0
				? `${used} ta yozuv "${category.name}" kategoriyasida qoladi, faqat shu belgini yo'qotadi.`
				: "Buni qaytarib bo'lmaydi.",
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteSubcategory(category.id, subcategoryId),
				},
			],
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Kategoriyalar" }} />
			<View className="flex-1 bg-background">
				<ScrollView
					contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
					scrollEnabled={!dragging}
				>
					<SegmentedControl
						items={[
							{ key: "expense", label: "Chiqim" },
							{ key: "income", label: "Kirim" },
						]}
						value={type}
						onChange={(key) => {
							setType(key as TxType);
							// The order being dragged belongs to the list leaving the
							// screen, so the mode doesn't follow across.
							setReordering(false);
						}}
					/>

					{/* Above the list rather than after it: the list grows without
					    limit, and an action pinned to its end drifts further out of
					    reach with every category added. */}
					{visible.length > 0 &&
						(reordering ? (
							<Button
								label="Tayyor"
								fullWidth
								onPress={() => setReordering(false)}
								startIcon={<Ionicons name="checkmark" size={18} color="#fff" />}
							/>
						) : (
							<View className="flex-row gap-3">
								<View className="flex-1">
									<Button
										label="Yangi kategoriya"
										variant="soft"
										fullWidth
										onPress={openNewCategory}
										startIcon={
											<Ionicons name="add" size={18} color={tc.primary} />
										}
									/>
								</View>
								{visible.length > 1 && (
									<Button
										label="Tartiblash"
										variant="soft"
										color="secondary"
										onPress={() => setReordering(true)}
										startIcon={
											<Ionicons
												name="swap-vertical"
												size={18}
												color={tc.foreground}
											/>
										}
									/>
								)}
							</View>
						))}

					{reordering ? (
						<CategoryReorderList
							categories={visible}
							onReorder={(orderedIds) => reorderCategories(type, orderedIds)}
							onDragChange={setDragging}
						/>
					) : visible.length === 0 ? (
						<Card>
							<EmptyState
								icon="pricetags-outline"
								title={`${type === "income" ? "Kirim" : "Chiqim"} kategoriyalari yo'q`}
								message="Kategoriyalar yozuvlaringizni guruhlaydi va asosiy sahifadagi taqsimotni hosil qiladi."
								actionLabel="Yangi kategoriya"
								onAction={openNewCategory}
							/>
						</Card>
					) : (
						visible.map((category) => {
							const hex = categoryColorValue(category.color, isDark);
							return (
								<Card key={category.id}>
									<View className="flex-row items-center gap-3">
										<CategoryAvatar icon={category.icon} color={category.color} />
										<View className="flex-1">
											<Text
												className="font-semibold text-foreground"
												style={{ fontSize: tf.lg }}
												numberOfLines={1}
											>
												{category.name}
											</Text>
											<Text
												className="text-muted-foreground"
												style={{ fontSize: tf.sm }}
											>
												{category.subcategories.length} ta ichki kategoriya ·{" "}
												{countUsage(transactions, category.id)} ta yozuv
											</Text>
										</View>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`${category.name} — tahrirlash`}
											onPress={() => openEditCategory(category)}
											hitSlop={6}
											className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
										>
											<Ionicons name="create-outline" size={20} color={tc.foreground} />
										</Pressable>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`${category.name} — o'chirish`}
											onPress={() => confirmDeleteCategory(category)}
											hitSlop={6}
											className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
										>
											<Ionicons name="trash-outline" size={20} color={tc.danger} />
										</Pressable>
									</View>

									{/* Subcategories as chips in their own colors — tap to edit,
									    long-press to delete. */}
									<View className="flex-row flex-wrap gap-2 mt-3">
										{category.subcategories.map((subcategory) => {
											const subHex = categoryColorValue(subcategory.color, isDark);
											return (
												<Pressable
													key={subcategory.id}
													accessibilityRole="button"
													accessibilityLabel={`${subcategory.name} — tahrirlash`}
													onPress={() =>
														setSubDraft({
															categoryId: category.id,
															id: subcategory.id,
															name: subcategory.name,
															color: subcategory.color,
														})
													}
													onLongPress={() =>
														confirmDeleteSubcategory(
															category,
															subcategory.id,
															subcategory.name,
														)
													}
													className="flex-row items-center gap-2 rounded-full px-3 py-2 active:opacity-70"
													style={{
														backgroundColor: withAlpha(subHex, isDark ? 0.22 : 0.14),
													}}
												>
													<View
														style={{
															width: 8,
															height: 8,
															borderRadius: 4,
															backgroundColor: subHex,
														}}
													/>
													<Text
														className="font-medium text-foreground"
														style={{ fontSize: tf.sm }}
													>
														{subcategory.name}
													</Text>
												</Pressable>
											);
										})}

										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`${category.name} uchun ichki kategoriya qo'shish`}
											onPress={() =>
												setSubDraft({
													categoryId: category.id,
													name: "",
													color: nextCategoryColor(
														category.subcategories.map((s) => s.color),
													),
												})
											}
											className="flex-row items-center gap-1.5 rounded-full px-3 py-2 bg-muted active:opacity-70"
										>
											<Ionicons name="add" size={14} color={hex} />
											<Text
												className="font-medium text-muted-foreground"
												style={{ fontSize: tf.sm }}
											>
												Ichki kategoriya
											</Text>
										</Pressable>
									</View>
								</Card>
							);
						})
					)}

					<Text
						className="text-muted-foreground text-center px-4 pt-1"
						style={{ fontSize: tf.xs }}
					>
						{reordering
							? "Tartibni o'zgartirish uchun dastakni bosib turing va suring."
							: "Tahrirlash uchun ichki kategoriyaga bosing, o'chirish uchun uzoq bosing."}
					</Text>
				</ScrollView>
			</View>

			{/* Category editor ------------------------------------------------- */}
			<BottomSheet
				visible={!!categoryDraft}
				onClose={() => setCategoryDraft(null)}
				maxHeight="90%"
			>
				{categoryDraft && (
					<ScrollView
						contentContainerStyle={{ padding: 16, gap: 16 }}
						keyboardShouldPersistTaps="handled"
					>
						<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
							{categoryDraft.id
								? "Kategoriyani tahrirlash"
								: `Yangi ${type === "income" ? "kirim" : "chiqim"} kategoriyasi`}
						</Text>

						<View className="items-center">
							<CategoryAvatar
								icon={categoryDraft.icon}
								color={categoryDraft.color}
								size={64}
							/>
						</View>

						<InputField
							label="Nomi"
							required
							value={categoryDraft.name}
							onChangeText={(name) =>
								setCategoryDraft((draft) => (draft ? { ...draft, name } : draft))
							}
							placeholder="masalan, Oziq-ovqat"
							autoFocus={!categoryDraft.id}
						/>

						<ColorPicker
							label="Rang"
							value={categoryDraft.color}
							onChange={(color) =>
								setCategoryDraft((draft) => (draft ? { ...draft, color } : draft))
							}
						/>

						<IconPicker
							label="Ikonka"
							value={categoryDraft.icon}
							tint={categoryColorValue(categoryDraft.color, isDark)}
							onChange={(icon) =>
								setCategoryDraft((draft) => (draft ? { ...draft, icon } : draft))
							}
						/>

						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Bekor qilish"
									variant="outline"
									color="secondary"
									fullWidth
									onPress={() => setCategoryDraft(null)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Saqlash"
									fullWidth
									disabled={!categoryDraft.name.trim()}
									onPress={saveCategory}
								/>
							</View>
						</View>
					</ScrollView>
				)}
			</BottomSheet>

			{/* Subcategory editor ---------------------------------------------- */}
			<BottomSheet
				visible={!!subDraft}
				onClose={() => setSubDraft(null)}
				maxHeight="85%"
			>
				{subDraft && (
					<ScrollView
						contentContainerStyle={{ padding: 16, gap: 16 }}
						keyboardShouldPersistTaps="handled"
					>
						<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
							{subDraft.id
								? "Ichki kategoriyani tahrirlash"
								: "Yangi ichki kategoriya"}
						</Text>

						<InputField
							label="Nomi"
							required
							value={subDraft.name}
							onChangeText={(name) =>
								setSubDraft((draft) => (draft ? { ...draft, name } : draft))
							}
							placeholder="masalan, Kofe"
							autoFocus={!subDraft.id}
						/>

						<ColorPicker
							label="Rang"
							value={subDraft.color}
							onChange={(color) =>
								setSubDraft((draft) => (draft ? { ...draft, color } : draft))
							}
						/>

						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Bekor qilish"
									variant="outline"
									color="secondary"
									fullWidth
									onPress={() => setSubDraft(null)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Saqlash"
									fullWidth
									disabled={!subDraft.name.trim()}
									onPress={saveSubcategory}
								/>
							</View>
						</View>

						{subDraft.id && (
							<Button
								label="Ichki kategoriyani o'chirish"
								variant="text"
								color="danger"
								fullWidth
								onPress={() => {
									const category = categories.find((c) => c.id === subDraft.categoryId);
									if (!category || !subDraft.id) return;
									setSubDraft(null);
									confirmDeleteSubcategory(category, subDraft.id, subDraft.name);
								}}
							/>
						)}
					</ScrollView>
				)}
			</BottomSheet>
		</>
	);
}
