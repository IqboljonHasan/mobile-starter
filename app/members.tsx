import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import ScrollShadow from "@/components/ScrollShadow";
import { BottomSheet, Button, Card, ColorPicker, EmptyState, InputField } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useScrolled } from "@/hooks/useScrolled";
import { useTheme } from "@/hooks/useTheme";
import { type CategoryColor, nextCategoryColor } from "@/lib/categoryColors";
import type { FamilyMember } from "@/lib/types";
import "../global.css";

type MemberDraftState = {
	/** Absent when creating. */
	id?: string;
	name: string;
	color: CategoryColor;
};

/**
 * The household an expense can be spent on — opened from the ledger's ⋮ menu.
 *
 * The editor is a bottom sheet, as the categories' is: two short fields, and
 * the list staying behind it shows whose name is being changed.
 */
export default function MembersScreen() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { members, transactions, addMember, updateMember, deleteMember } = useLedger();
	const { scrolled, scrollProps } = useScrolled();
	const [draft, setDraft] = useState<MemberDraftState | null>(null);

	const usage = useMemo(() => {
		const counts = new Map<string, number>();
		for (const t of transactions) {
			if (t.memberId) counts.set(t.memberId, (counts.get(t.memberId) ?? 0) + 1);
		}
		return counts;
	}, [transactions]);

	const openNew = () =>
		setDraft({ name: "", color: nextCategoryColor(members.map((m) => m.color)) });

	const save = () => {
		if (!draft) return;
		const name = draft.name.trim();
		if (!name) return;
		if (draft.id) updateMember(draft.id, { name, color: draft.color });
		else addMember({ name, color: draft.color });
		setDraft(null);
	};

	const confirmDelete = (member: FamilyMember) => {
		const used = usage.get(member.id) ?? 0;
		Alert.alert(
			`"${member.name}" o'chirilsinmi?`,
			used > 0
				? `${used} ta chiqim saqlanadi, faqat kimga sarflangani yo'qoladi.`
				: "Buni qaytarib bo'lmaydi.",
			[
				{ text: "Bekor qilish", style: "cancel" },
				{ text: "O'chirish", style: "destructive", onPress: () => deleteMember(member.id) },
			],
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Oila a'zolari" }} />
			<View className="flex-1 bg-background">
				<ScrollView
					{...scrollProps}
					contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 4, gap: 12, paddingBottom: 40 }}
					showsVerticalScrollIndicator={false}
				>
					{members.length === 0 ? (
						<Card>
							<EmptyState
								icon="people-outline"
								title="Hali oila a'zosi yo'q"
								message="Qo'shilganlar chiqim formasida chiqadi — pul kimga sarflanganini belgilaysiz."
								actionLabel="Yangi a'zo"
								onAction={openNew}
							/>
						</Card>
					) : (
						<>
							<Button
								label="Yangi a'zo"
								variant="soft"
								fullWidth
								onPress={openNew}
								startIcon={<Ionicons name="add" size={18} color={tc.primary} />}
							/>
							<Card flush>
								{members.map((member, index) => (
									<Pressable
										key={member.id}
										accessibilityRole="button"
										accessibilityLabel={`${member.name} — tahrirlash`}
										onPress={() => setDraft({ id: member.id, name: member.name, color: member.color })}
										onLongPress={() => confirmDelete(member)}
										className={`flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${
											index > 0 ? "border-t border-border" : ""
										}`}
									>
										<ContactAvatar name={member.name} id={member.id} color={member.color} />
										<View className="flex-1">
											<Text
												className="font-bold text-foreground"
												style={{ fontSize: tf.base }}
												numberOfLines={1}
											>
												{member.name}
											</Text>
											<Text className="text-muted-foreground" style={{ fontSize: tf.sm }}>
												{`${usage.get(member.id) ?? 0} ta chiqim`}
											</Text>
										</View>
										<Pressable
											accessibilityRole="button"
											accessibilityLabel={`${member.name} — o'chirish`}
											onPress={() => confirmDelete(member)}
											hitSlop={6}
											className="w-10 h-10 items-center justify-center rounded-full active:opacity-60"
										>
											<Ionicons name="trash-outline" size={20} color={tc.danger} />
										</Pressable>
									</Pressable>
								))}
							</Card>
						</>
					)}
				</ScrollView>
				<ScrollShadow visible={scrolled} />
			</View>

			<BottomSheet visible={!!draft} onClose={() => setDraft(null)} maxHeight="85%">
				{draft && (
					<ScrollView
						contentContainerStyle={{ padding: 16, gap: 16 }}
						keyboardShouldPersistTaps="handled"
					>
						<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
							{draft.id ? "A'zoni tahrirlash" : "Yangi oila a'zosi"}
						</Text>

						<View className="items-center">
							<ContactAvatar
								name={draft.name || "?"}
								id={draft.id ?? "new"}
								color={draft.color}
								size={64}
							/>
						</View>

						<InputField
							label="Ism"
							required
							value={draft.name}
							onChangeText={(name) => setDraft((d) => (d ? { ...d, name } : d))}
							placeholder="masalan, Ali yoki Onam"
							autoFocus={!draft.id}
						/>

						<ColorPicker
							label="Rang"
							takenColors={members.filter((m) => m.id !== draft.id).map((m) => m.color)}
							value={draft.color}
							onChange={(color) => setDraft((d) => (d ? { ...d, color } : d))}
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
								<Button label="Saqlash" fullWidth disabled={!draft.name.trim()} onPress={save} />
							</View>
						</View>
					</ScrollView>
				)}
			</BottomSheet>
		</>
	);
}
