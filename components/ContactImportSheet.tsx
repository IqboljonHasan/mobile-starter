import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	FlatList,
	Pressable,
	Text,
	TextInput,
	View,
} from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { BottomSheet, Button, EmptyState } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { matchContact, normalizePhone } from "@/lib/debts";
import {
	IMPORT_MESSAGES,
	type PhoneContact,
	readPhoneContacts,
} from "@/lib/phoneContacts";
import type { Contact } from "@/lib/types";

/**
 * Picks people out of the phone's address book.
 *
 * Deliberately a selection rather than a bulk copy: an address book holds
 * hundreds of names and a handful of them will ever be owed money, so
 * importing all of it would bury the few debts the user actually has under
 * everyone they have ever called. The list opens with nothing ticked.
 *
 * Nothing is read until this sheet is opened, which is also when permission is
 * asked for — a user who never opens it is never prompted.
 */
export default function ContactImportSheet({
	visible,
	onClose,
	onImport,
	existing,
}: {
	visible: boolean;
	onClose: () => void;
	onImport: (contacts: PhoneContact[]) => void;
	/** Already in the app — shown as such rather than hidden, so the list
	 *  matches the phone's own and the user isn't left hunting for a name. */
	existing: Contact[];
}) {
	const { tc } = useTheme();
	const { tf } = useFont();

	const [loading, setLoading] = useState(true);
	const [contacts, setContacts] = useState<PhoneContact[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [query, setQuery] = useState("");
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		if (!visible) return;
		let cancelled = false;

		(async () => {
			const result = await readPhoneContacts();
			if (cancelled) return;

			if (result.status === "ok") {
				setContacts(result.contacts);
				setLoading(false);
				return;
			}

			setFailed(true);
			setLoading(false);
			const { title, message } = IMPORT_MESSAGES[result.status];
			Alert.alert(title, message);
			onClose();
		})();

		return () => {
			cancelled = true;
		};
	}, [visible, onClose]);

	const needle = query.trim().toLowerCase();
	const digits = normalizePhone(query);
	const filtered = needle
		? contacts.filter(
				(c) =>
					c.name.toLowerCase().includes(needle) ||
					(digits.length > 0 && normalizePhone(c.phone).includes(digits)),
			)
		: contacts;

	const toggle = (sourceId: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(sourceId)) next.delete(sourceId);
			else next.add(sourceId);
			return next;
		});
	};

	const submit = () => {
		onImport(contacts.filter((c) => selected.has(c.sourceId)));
		onClose();
	};

	return (
		<BottomSheet visible={visible} onClose={onClose} maxHeight="90%">
			<View className="px-4 pt-2 pb-3 gap-3">
				<View className="flex-row items-center justify-between gap-3">
					<Text
						className="flex-1 font-bold text-foreground"
						style={{ fontSize: tf.xl }}
					>
						Telefondan import
					</Text>
					{selected.size > 0 && (
						<Pressable
							accessibilityRole="button"
							onPress={() => setSelected(new Set())}
							className="px-3 py-1.5 rounded-full bg-muted active:opacity-70"
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

				{!loading && !failed && contacts.length > 0 && (
					<View
						className="flex-row items-center gap-2 rounded-xl px-4"
						style={{
							backgroundColor: tc.card,
							borderWidth: 1,
							borderColor: tc.border,
							minHeight: 48,
						}}
					>
						<Ionicons name="search" size={18} color={tc.mutedForeground} />
						<TextInput
							className="flex-1 py-3"
							style={{ color: tc.foreground, fontSize: tf.base }}
							placeholder="Ism yoki raqam"
							placeholderTextColor={tc.placeholder}
							value={query}
							onChangeText={setQuery}
						/>
					</View>
				)}
			</View>

			{loading ? (
				<View className="items-center py-12">
					<ActivityIndicator color={tc.primary} />
					<Text
						className="text-muted-foreground mt-3"
						style={{ fontSize: tf.base }}
					>
						{"Kontaktlar o'qilmoqda…"}
					</Text>
				</View>
			) : contacts.length === 0 ? (
				<EmptyState
					icon="people-outline"
					title="Kontakt topilmadi"
					message="Telefoningizda saqlangan kontakt yo'q."
				/>
			) : (
				<FlatList
					data={filtered}
					keyExtractor={(item) => item.sourceId}
					keyboardShouldPersistTaps="handled"
					contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
					ListEmptyComponent={
						<View className="items-center py-10">
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.base }}
							>
								{`"${query}" bo'yicha hech kim topilmadi.`}
							</Text>
						</View>
					}
					renderItem={({ item }) => {
						const already = matchContact(existing, item);
						const checked = selected.has(item.sourceId);
						return (
							<Pressable
								accessibilityRole="checkbox"
								accessibilityState={{ checked }}
								onPress={() => toggle(item.sourceId)}
								className="flex-row items-center gap-3 py-2.5 border-b border-border active:opacity-70"
							>
								<ContactAvatar name={item.name} id={item.sourceId} size={34} />
								<View className="flex-1">
									<Text
										className="text-foreground"
										style={{ fontSize: tf.base }}
										numberOfLines={1}
									>
										{item.name}
									</Text>
									<Text
										className="text-muted-foreground"
										style={{ fontSize: tf.sm }}
										numberOfLines={1}
									>
										{already
											? "Allaqachon qo'shilgan"
											: item.phone || "Raqam yo'q"}
									</Text>
								</View>
								<View
									className="w-6 h-6 rounded-md items-center justify-center"
									style={{
										backgroundColor: checked ? tc.primary : "transparent",
										borderWidth: checked ? 0 : 1.5,
										borderColor: tc.border,
									}}
								>
									{checked && <Ionicons name="checkmark" size={16} color="#fff" />}
								</View>
							</Pressable>
						);
					}}
				/>
			)}

			{!loading && contacts.length > 0 && (
				<View className="flex-row gap-3 px-4 pt-3">
					<View className="flex-1">
						<Button
							label="Bekor qilish"
							variant="outline"
							color="secondary"
							fullWidth
							onPress={onClose}
						/>
					</View>
					<View className="flex-1">
						<Button
							label={
								selected.size > 0 ? `Qo'shish (${selected.size})` : "Qo'shish"
							}
							fullWidth
							disabled={selected.size === 0}
							onPress={submit}
						/>
					</View>
				</View>
			)}
		</BottomSheet>
	);
}
