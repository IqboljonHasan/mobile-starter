import { Ionicons } from "@expo/vector-icons";
import { Stack } from "expo-router";
import { useMemo, useState } from "react";
import {
	Alert,
	Linking,
	Pressable,
	ScrollView,
	Text,
	TextInput,
	View,
} from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import ContactImportSheet from "@/components/ContactImportSheet";
import ContactSheet from "@/components/ContactSheet";
import { Button, Card, EmptyState } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useSafeRouter as useRouter } from "@/hooks/useSafeRouter";
import { useTheme } from "@/hooks/useTheme";
import {
	contactTotals,
	debtsOfContact,
	isSettled,
	normalizePhone,
	sortContacts,
} from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Contact } from "@/lib/types";
import "../global.css";

/**
 * The people debts are with.
 *
 * A contact is the app's own record rather than a live pointer into the phone
 * book — see lib/debts.ts — so this screen is where they are added, corrected
 * and pulled in from the phone. Each row carries what that person currently
 * owes or is owed, which is the only reason to be looking at this list rather
 * than at the phone's own contacts app.
 */
export default function ContactsScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const { contacts, debts, addContact, updateContact, deleteContact, importContacts } =
		useLedger();

	const [query, setQuery] = useState("");
	const [editing, setEditing] = useState<Contact | null>(null);
	const [creating, setCreating] = useState(false);
	const [importing, setImporting] = useState(false);

	const ordered = useMemo(() => sortContacts(contacts, debts), [contacts, debts]);

	const needle = query.trim().toLowerCase();
	const digits = normalizePhone(query);
	const visible = needle
		? ordered.filter(
				(c) =>
					c.name.toLowerCase().includes(needle) ||
					(digits.length > 0 && normalizePhone(c.phone).includes(digits)),
			)
		: ordered;

	const confirmDelete = (contact: Contact) => {
		const related = debtsOfContact(debts, contact.id);
		const open = related.filter((d) => !isSettled(d)).length;

		// Debts are never cascaded away with the person, for the same reason a
		// transaction outlives its category: the money still moved. They are
		// listed here so the user knows what the record will lose.
		Alert.alert(
			`"${contact.name}" o'chirilsinmi?`,
			related.length === 0
				? "Buni qaytarib bo'lmaydi."
				: `${related.length} ta qarz (${open} tasi ochiq) saqlanib qoladi, lekin ular "Noma'lum" bo'lib ko'rinadi. Buni qaytarib bo'lmaydi.`,
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "O'chirish",
					style: "destructive",
					onPress: () => deleteContact(contact.id),
				},
			],
		);
	};

	const runImport = (imported: Parameters<typeof importContacts>[0]) => {
		const { added, updated } = importContacts(imported);
		Alert.alert(
			"Import qilindi",
			[
				added > 0 ? `${added} ta yangi kontakt qo'shildi.` : null,
				updated > 0 ? `${updated} tasi allaqachon bor edi.` : null,
			]
				.filter(Boolean)
				.join(" ") || "Hech narsa qo'shilmadi.",
		);
	};

	return (
		<>
			<Stack.Screen options={{ title: "Kontaktlar" }} />
			<ScrollView
				className="flex-1 bg-background"
				contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<View className="flex-row gap-3">
					<View className="flex-1">
						<Button
							label="Yangi"
							variant="soft"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color={tc.primary} />}
							onPress={() => setCreating(true)}
						/>
					</View>
					<View className="flex-1">
						<Button
							label="Telefondan"
							variant="soft"
							color="secondary"
							fullWidth
							startIcon={
								<Ionicons
									name="phone-portrait-outline"
									size={18}
									color={tc.foreground}
								/>
							}
							onPress={() => setImporting(true)}
						/>
					</View>
				</View>

				{contacts.length > 4 && (
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

				{contacts.length === 0 ? (
					<EmptyState
						icon="people-outline"
						title="Hali kontakt yo'q"
						message="Qarzni kim bilan yuritishingizni shu yerda qo'shing yoki telefoningizdan import qiling."
						actionLabel="Yangi kontakt"
						onAction={() => setCreating(true)}
					/>
				) : visible.length === 0 ? (
					<EmptyState
						icon="search-outline"
						title="Topilmadi"
						message={`"${query}" bo'yicha hech kim yo'q.`}
					/>
				) : (
					<Card flush>
						{visible.map((contact, index) => (
							<ContactRow
								key={contact.id}
								contact={contact}
								totals={contactTotals(debts, contact.id)}
								debtCount={debtsOfContact(debts, contact.id).length}
								divider={index > 0}
								onPress={() => setEditing(contact)}
								onDelete={() => confirmDelete(contact)}
								onCall={
									contact.phone
										? () => Linking.openURL(`tel:${contact.phone}`)
										: undefined
								}
							/>
						))}
					</Card>
				)}

				{contacts.length > 0 && (
					<Button
						label="Qarzlarni ko'rish"
						variant="text"
						fullWidth
						endIcon={
							<Ionicons name="arrow-forward" size={16} color={tc.primary} />
						}
						onPress={() => router.back()}
					/>
				)}
			</ScrollView>

			<ContactSheet
				key={creating ? "create-open" : "create-closed"}
				visible={creating}
				onClose={() => setCreating(false)}
				onSubmit={addContact}
			/>

			<ContactSheet
				key={editing?.id ?? "edit-closed"}
				visible={!!editing}
				onClose={() => setEditing(null)}
				existing={editing}
				onSubmit={(draft) => editing && updateContact(editing.id, draft)}
			/>

			<ContactImportSheet
				key={importing ? "import-open" : "import-closed"}
				visible={importing}
				onClose={() => setImporting(false)}
				onImport={runImport}
				existing={contacts}
			/>
		</>
	);
}

function ContactRow({
	contact,
	totals,
	debtCount,
	divider,
	onPress,
	onDelete,
	onCall,
}: {
	contact: Contact;
	totals: ReturnType<typeof contactTotals>;
	debtCount: number;
	divider?: boolean;
	onPress: () => void;
	onDelete: () => void;
	onCall?: () => void;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const handlePress = useGuardedPress(onPress);
	const handleCall = useGuardedPress(onCall);

	// Both directions can be open with the same person at once, so they're
	// listed rather than netted off — owing somebody 100 while they owe you 100
	// is two debts to settle, not zero.
	const lines = totals.flatMap((total) => [
		total.owedToMe > 0
			? {
					key: `${total.unit}-in`,
					text: `Sizga: ${formatAmount(total.owedToMe, total.unit)}`,
					className: "text-success",
				}
			: null,
		total.owedByMe > 0
			? {
					key: `${total.unit}-out`,
					text: `Siz: ${formatAmount(total.owedByMe, total.unit)}`,
					className: "text-danger",
				}
			: null,
	]);

	const open = lines.filter((l) => l !== null);

	return (
		<Pressable
			accessibilityRole="button"
			onPress={handlePress}
			onLongPress={onDelete}
			className={`flex-row items-center gap-3 px-4 py-3 active:opacity-70 ${
				divider ? "border-t border-border" : ""
			}`}
		>
			<ContactAvatar name={contact.name} id={contact.id} />

			<View className="flex-1">
				<Text
					className="font-medium text-foreground"
					style={{ fontSize: tf.base }}
					numberOfLines={1}
				>
					{contact.name}
				</Text>
				{open.length > 0 ? (
					<View className="flex-row flex-wrap gap-x-3">
						{open.map((line) => (
							<Text
								key={line.key}
								className={`font-medium ${line.className}`}
								style={{ fontSize: tf.sm }}
							>
								{line.text}
							</Text>
						))}
					</View>
				) : (
					<Text
						className="text-muted-foreground"
						style={{ fontSize: tf.sm }}
						numberOfLines={1}
					>
						{debtCount > 0
							? `${debtCount} ta qarz · hammasi yopilgan`
							: contact.phone || "Ochiq qarz yo'q"}
					</Text>
				)}
			</View>

			{!!onCall && (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${contact.name} ga qo'ng'iroq qilish`}
					onPress={handleCall}
					hitSlop={8}
					className="w-9 h-9 rounded-full items-center justify-center bg-muted active:opacity-70"
				>
					<Ionicons name="call-outline" size={16} color={tc.mutedForeground} />
				</Pressable>
			)}
		</Pressable>
	);
}
