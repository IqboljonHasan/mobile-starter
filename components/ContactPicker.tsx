import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import ContactImportSheet from "@/components/ContactImportSheet";
import ContactSheet from "@/components/ContactSheet";
import TagPill from "@/components/TagPill";
import { BottomSheet, Button, Chip, FieldLabel, IconButton } from "@/components/ui";
import { Text, TextInput } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { contactBalance, contactBalanceText, contactInitials, sortContacts, TAG_META } from "@/lib/debts";
import { foldForSearch, matchesSearch } from "@/lib/search";
import { CONTACT_TAGS, type Contact, type ContactTag, type Debt } from "@/lib/types";

/** Long enough for one sheet to be gone before the next is opened. */
const SHEET_SWAP_MS = 280;

/**
 * Picks the person a debt is with, and can add them on the spot.
 *
 * The field shows who is picked and where things stand with them — whether
 * they owe the user or the other way round — since that is usually why this
 * person is being picked. The sheet it opens finds people by name or tag, and
 * adds somebody new, typed in or from the phone's contacts, without leaving
 * the form: a debt is recorded the moment it happens, and being sent off to
 * set up a contact first is how the record ends up never being made.
 */
export default function ContactPicker({
	value,
	onChange,
	label = "Kim bilan",
	sheetTitle = "Kimni tanlaysiz?",
	unit,
	error,
}: {
	value: string | null;
	onChange: (contactId: string | null) => void;
	label?: string;
	/** The question the sheet asks — "Kimga berdingiz?". */
	sheetTitle?: string;
	/** The debt's unit — a person's balance is shown in it when they have one. */
	unit?: string;
	error?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { contacts, debts, addContact, importContacts } = useLedger();

	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [tagFilter, setTagFilter] = useState<ContactTag | "all">("all");
	const [creating, setCreating] = useState(false);
	const [importing, setImporting] = useState(false);

	const selected = contacts.find((c) => c.id === value) ?? null;

	const folded = foldForSearch(query);
	const people = useMemo(
		() =>
			sortContacts(contacts, debts).filter(
				(c) =>
					(tagFilter === "all" || c.tag === tagFilter) &&
					matchesSearch(folded, [c.name, c.phone]),
			),
		[contacts, debts, tagFilter, folded],
	);

	// One sheet at a time: the picker steps aside for the editor or the import
	// list and, from the import list, comes back to pick who was just added.
	const swapTo = (next: () => void) => {
		setOpen(false);
		setTimeout(next, SHEET_SWAP_MS);
	};

	return (
		<View>
			<FieldLabel required>{label}</FieldLabel>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${label}: ${selected?.name ?? "tanlanmagan"}`}
				onPress={() => setOpen(true)}
				className="flex-row items-center active:opacity-70"
				style={{
					minHeight: 64,
					gap: 12,
					paddingVertical: 10,
					paddingLeft: 10,
					paddingRight: 12,
					borderRadius: 16,
					backgroundColor: tc.card,
					borderWidth: 1.5,
					borderColor: error ? tc.danger : "transparent",
				}}
			>
				{selected ? (
					<PersonLine contact={selected} debts={debts} unit={unit} avatarBg={tc.background} />
				) : (
					<Text
						className="flex-1 font-bold"
						style={{ fontSize: tf.base, color: tc.placeholder, paddingLeft: 4 }}
					>
						Tanlang
					</Text>
				)}
				<Ionicons name="chevron-down" size={18} color={tc.mutedForeground} />
			</Pressable>
			{!!error && (
				<Text className="font-semibold text-danger mt-1.5 ml-1" style={{ fontSize: tf.sm }}>
					{error}
				</Text>
			)}

			<BottomSheet visible={open} onClose={() => setOpen(false)} maxHeight="80%">
				<View className="flex-row items-center justify-between gap-3" style={{ paddingLeft: 20, paddingRight: 12 }}>
					<Text
						accessibilityRole="header"
						className="font-extrabold text-foreground"
						style={{ fontSize: tf.xl, letterSpacing: -0.2 }}
					>
						{sheetTitle}
					</Text>
					<IconButton
						variant="filled"
						icon="close"
						accessibilityLabel="Yopish"
						onPress={() => setOpen(false)}
					/>
				</View>

				<View style={{ paddingHorizontal: 18, paddingTop: 12 }}>
					<View
						className="flex-row items-center"
						style={{ gap: 10, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: tc.card }}
					>
						<Ionicons name="search" size={18} color={tc.mutedForeground} />
						<TextInput
							accessibilityLabel="Ism bo'yicha qidirish"
							value={query}
							onChangeText={setQuery}
							placeholder="Ism bo'yicha qidirish"
							placeholderTextColor={tc.placeholder}
							autoCorrect={false}
							className="flex-1 font-semibold"
							style={{ fontSize: tf.base, color: tc.foreground, paddingVertical: 0 }}
						/>
						{!!query && (
							<Pressable accessibilityLabel="Tozalash" onPress={() => setQuery("")} hitSlop={10}>
								<Ionicons name="close-circle" size={18} color={tc.mutedForeground} />
							</Pressable>
						)}
					</View>
				</View>

				<View
					accessibilityRole="radiogroup"
					accessibilityLabel="Teg bo'yicha saralash"
					className="flex-row"
					style={{ gap: 6, paddingHorizontal: 18, paddingTop: 12, paddingBottom: 6 }}
				>
					<Chip
						size="sm"
						role="radio"
						label="Hammasi"
						active={tagFilter === "all"}
						onPress={() => setTagFilter("all")}
					/>
					{CONTACT_TAGS.map((tag) => (
						<Chip
							key={tag}
							size="sm"
							role="radio"
							label={TAG_META[tag].plural}
							active={tagFilter === tag}
							onPress={() => setTagFilter(tag)}
						/>
					))}
				</View>

				<ScrollView
					style={{ flexShrink: 1 }}
					contentContainerStyle={{ paddingHorizontal: 10, paddingTop: 2, paddingBottom: 6 }}
					keyboardShouldPersistTaps="handled"
				>
					{people.length === 0 ? (
						<Text
							className="font-semibold text-muted-foreground text-center"
							style={{ fontSize: tf.sm, paddingVertical: 28, paddingHorizontal: 20 }}
						>
							{contacts.length === 0
								? "Hali hech kim yo'q — pastdan qo'shing yoki kontaktlardan oling."
								: "Bu qidiruv bo'yicha hech kim topilmadi."}
						</Text>
					) : (
						people.map((contact) => {
							const isSelected = contact.id === value;
							return (
								<Pressable
									key={contact.id}
									accessibilityRole="radio"
									accessibilityState={{ checked: isSelected }}
									onPress={() => {
										onChange(contact.id);
										setOpen(false);
									}}
									className="flex-row items-center active:opacity-70"
									style={{
										minHeight: 64,
										gap: 12,
										padding: 10,
										borderRadius: 16,
										backgroundColor: isSelected ? tc.card : "transparent",
									}}
								>
									<PersonLine contact={contact} debts={debts} unit={unit} avatarBg={tc.muted} />
									{isSelected && <Ionicons name="checkmark" size={20} color={tc.foreground} />}
								</Pressable>
							);
						})
					)}
				</ScrollView>

				<View className="flex-row" style={{ gap: 6, paddingHorizontal: 18, paddingTop: 6 }}>
					<View className="flex-1">
						<Button
							label="Kontaktlardan"
							variant="soft"
							fullWidth
							accessibilityLabel="Telefon kontaktlaridan import qilish"
							startIcon={<Ionicons name="id-card-outline" size={18} color={tc.foreground} />}
							onPress={() => swapTo(() => setImporting(true))}
						/>
					</View>
					<View className="flex-1">
						<Button
							label="Yangi kishi"
							variant="soft"
							fullWidth
							startIcon={<Ionicons name="add" size={18} color={tc.foreground} />}
							onPress={() => swapTo(() => setCreating(true))}
						/>
					</View>
				</View>
			</BottomSheet>

			{/* Somebody added here is picked straight away — adding them and then
			    having to find them in the list again is a step with no purpose. */}
			<ContactSheet
				key={creating ? "contact-new-open" : "contact-new-closed"}
				visible={creating}
				onClose={() => setCreating(false)}
				initialName={query.trim()}
				onSubmit={(draft) => {
					onChange(addContact(draft).id);
					setQuery("");
				}}
			/>

			<ContactImportSheet
				key={importing ? "contact-import-open" : "contact-import-closed"}
				visible={importing}
				onClose={() => {
					setImporting(false);
					setTimeout(() => setOpen(true), SHEET_SWAP_MS);
				}}
				onImport={importContacts}
				existing={contacts}
			/>
		</View>
	);
}

/** Initials, the name with its tag, and where things stand with the person. */
function PersonLine({
	contact,
	debts,
	unit,
	avatarBg,
}: {
	contact: Contact;
	debts: Debt[];
	unit?: string;
	avatarBg: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const status = contactBalanceText(contactBalance(debts, contact.id, unit));
	const statusColor =
		status.tone === "success" ? tc.success : status.tone === "danger" ? tc.danger : tc.mutedForeground;

	return (
		<>
			<View
				className="items-center justify-center"
				style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: avatarBg }}
			>
				<Text className="font-extrabold text-foreground" style={{ fontSize: tf.sm }}>
					{contactInitials(contact.name)}
				</Text>
			</View>
			<View className="flex-1" style={{ gap: 3 }}>
				<View className="flex-row items-center" style={{ gap: 8 }}>
					<Text
						className="font-bold text-foreground shrink"
						style={{ fontSize: tf.base }}
						numberOfLines={1}
					>
						{contact.name}
					</Text>
					{!!contact.tag && <TagPill tag={contact.tag} />}
				</View>
				<Text className="font-semibold" style={{ fontSize: tf.sm - 0.5, color: statusColor }} numberOfLines={1}>
					{status.text}
				</Text>
			</View>
		</>
	);
}
