import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import CategoryAvatar from "@/components/CategoryAvatar";
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
		addSubcategory,
		updateSubcategory,
		deleteSubcategory,
	} = useLedger();

	const [type, setType] = useState<TxType>("expense");
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
			`Delete "${category.name}"?`,
			used > 0
				? `${used} ${used === 1 ? "entry uses" : "entries use"} this category. ${
						used === 1 ? "It" : "They"
					} will be kept and shown as uncategorized.`
				: "Its subcategories will be deleted too.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
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
			`Delete "${name}"?`,
			used > 0
				? `${used} ${used === 1 ? "entry keeps" : "entries keep"} the "${category.name}" category and lose just this label.`
				: "This can't be undone.",
			[
				{ text: "Cancel", style: "cancel" },
				{
					text: "Delete",
					style: "destructive",
					onPress: () => deleteSubcategory(category.id, subcategoryId),
				},
			],
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Categories" }} />
			<View className="flex-1 bg-background">
				<ScrollView
					contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
				>
					<SegmentedControl
						items={[
							{ key: "expense", label: "Expense" },
							{ key: "income", label: "Income" },
						]}
						value={type}
						onChange={(key) => setType(key as TxType)}
					/>

					{visible.length === 0 ? (
						<Card>
							<EmptyState
								icon="pricetags-outline"
								title={`No ${type} categories`}
								message="Categories group your entries and give the dashboard something to break down."
								actionLabel="New category"
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
												{category.subcategories.length}{" "}
												{category.subcategories.length === 1
													? "subcategory"
													: "subcategories"}{" "}
												· {countUsage(transactions, category.id)} entries
											</Text>
										</View>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`Edit ${category.name}`}
											onPress={() => openEditCategory(category)}
											hitSlop={6}
											className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
										>
											<Ionicons name="create-outline" size={20} color={tc.foreground} />
										</Pressable>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`Delete ${category.name}`}
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
													accessibilityLabel={`Edit ${subcategory.name}`}
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
											accessibilityLabel={`Add subcategory to ${category.name}`}
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
												Subcategory
											</Text>
										</Pressable>
									</View>
								</Card>
							);
						})
					)}

					{visible.length > 0 && (
						<Button
							label="New category"
							variant="soft"
							fullWidth
							onPress={openNewCategory}
							startIcon={<Ionicons name="add" size={18} color={tc.primary} />}
						/>
					)}

					<Text
						className="text-muted-foreground text-center px-4 pt-1"
						style={{ fontSize: tf.xs }}
					>
						Tap a subcategory to edit it, long-press to delete it.
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
							{categoryDraft.id ? "Edit category" : `New ${type} category`}
						</Text>

						<View className="items-center">
							<CategoryAvatar
								icon={categoryDraft.icon}
								color={categoryDraft.color}
								size={64}
							/>
						</View>

						<InputField
							label="Name"
							required
							value={categoryDraft.name}
							onChangeText={(name) =>
								setCategoryDraft((draft) => (draft ? { ...draft, name } : draft))
							}
							placeholder="e.g. Groceries"
							autoFocus={!categoryDraft.id}
						/>

						<ColorPicker
							label="Color"
							value={categoryDraft.color}
							onChange={(color) =>
								setCategoryDraft((draft) => (draft ? { ...draft, color } : draft))
							}
						/>

						<IconPicker
							label="Icon"
							value={categoryDraft.icon}
							tint={categoryColorValue(categoryDraft.color, isDark)}
							onChange={(icon) =>
								setCategoryDraft((draft) => (draft ? { ...draft, icon } : draft))
							}
						/>

						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Cancel"
									variant="outline"
									color="secondary"
									fullWidth
									onPress={() => setCategoryDraft(null)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Save"
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
							{subDraft.id ? "Edit subcategory" : "New subcategory"}
						</Text>

						<InputField
							label="Name"
							required
							value={subDraft.name}
							onChangeText={(name) =>
								setSubDraft((draft) => (draft ? { ...draft, name } : draft))
							}
							placeholder="e.g. Coffee"
							autoFocus={!subDraft.id}
						/>

						<ColorPicker
							label="Color"
							value={subDraft.color}
							onChange={(color) =>
								setSubDraft((draft) => (draft ? { ...draft, color } : draft))
							}
						/>

						<View className="flex-row gap-3">
							<View className="flex-1">
								<Button
									label="Cancel"
									variant="outline"
									color="secondary"
									fullWidth
									onPress={() => setSubDraft(null)}
								/>
							</View>
							<View className="flex-1">
								<Button
									label="Save"
									fullWidth
									disabled={!subDraft.name.trim()}
									onPress={saveSubcategory}
								/>
							</View>
						</View>

						{subDraft.id && (
							<Button
								label="Delete subcategory"
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
