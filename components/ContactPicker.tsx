import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import ContactImportSheet from "@/components/ContactImportSheet";
import ContactSheet from "@/components/ContactSheet";
import { Select } from "@/components/ui";
import { useLedger } from "@/contexts/LedgerContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { sortContacts } from "@/lib/debts";

/**
 * Picks the person a debt is with, and can create them on the spot.
 *
 * Adding and importing live in the sheet's own header rather than behind a
 * trip to the contacts screen: a debt is usually recorded the moment it
 * happens, and being sent away to set up a contact first is how the record
 * ends up never being made.
 */
export default function ContactPicker({
	value,
	onChange,
	label = "Kontakt",
	error,
}: {
	value: string | null;
	onChange: (contactId: string | null) => void;
	label?: string;
	error?: string;
}) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { contacts, debts, addContact, importContacts } = useLedger();

	const [creating, setCreating] = useState(false);
	const [importing, setImporting] = useState(false);

	const ordered = sortContacts(contacts, debts);
	const selected = contacts.find((c) => c.id === value) ?? null;

	return (
		<View>
			<Text
				className="font-medium text-foreground mb-1.5"
				style={{ fontSize: tf.base }}
			>
				{label}
				<Text className="text-danger"> *</Text>
			</Text>

			<Select
				label={label}
				value={value}
				toggleOff={false}
				onChange={onChange}
				options={ordered.map((c) => ({ key: c.id, label: c.name }))}
				emptyMessage="Hali kontakt yo'q — quyidagidan qo'shing."
				headerRight={
					<View className="flex-row gap-2">
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Telefondan import qilish"
							onPress={() => setImporting(true)}
							className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted active:opacity-70"
						>
							<Ionicons
								name="phone-portrait-outline"
								size={14}
								color={tc.mutedForeground}
							/>
							<Text
								className="font-medium text-muted-foreground"
								style={{ fontSize: tf.sm }}
							>
								Import
							</Text>
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel="Yangi kontakt qo'shish"
							onPress={() => setCreating(true)}
							className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-highlight active:opacity-70"
						>
							<Ionicons name="add" size={14} color={tc.primary} />
							<Text
								className="font-medium text-primary"
								style={{ fontSize: tf.sm }}
							>
								Yangi
							</Text>
						</Pressable>
					</View>
				}
				renderOption={(option, isSelected) => {
					const contact = contacts.find((c) => c.id === option.key);
					return (
						<View className="flex-row items-center gap-3 py-2.5">
							<ContactAvatar
								name={option.label}
								id={String(option.key)}
								size={34}
							/>
							<View className="flex-1">
								<Text
									className={
										isSelected ? "font-bold text-primary" : "text-foreground"
									}
									style={{ fontSize: tf.base }}
									numberOfLines={1}
								>
									{option.label}
								</Text>
								{!!contact?.phone && (
									<Text
										className="text-muted-foreground"
										style={{ fontSize: tf.sm }}
										numberOfLines={1}
									>
										{contact.phone}
									</Text>
								)}
							</View>
							{isSelected && (
								<Ionicons name="checkmark" size={20} color={tc.primary} />
							)}
						</View>
					);
				}}
				trigger={({ open }) => (
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={`${label}: ${selected?.name ?? "tanlanmagan"}`}
						onPress={open}
						className="flex-row items-center gap-3 rounded-xl px-4 active:opacity-70"
						style={{
							backgroundColor: tc.card,
							borderWidth: error ? 1.5 : 1,
							borderColor: error ? tc.danger : tc.border,
							minHeight: 56,
						}}
					>
						{selected ? (
							<ContactAvatar name={selected.name} id={selected.id} size={34} />
						) : (
							<Ionicons name="person-outline" size={20} color={tc.mutedForeground} />
						)}
						<View className="flex-1">
							<Text
								style={{
									fontSize: tf.lg,
									color: selected ? tc.foreground : tc.placeholder,
								}}
								numberOfLines={1}
							>
								{selected?.name ?? "Kimni tanlang"}
							</Text>
							{!!selected?.phone && (
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
									numberOfLines={1}
								>
									{selected.phone}
								</Text>
							)}
						</View>
						<Ionicons name="chevron-down" size={16} color={tc.mutedForeground} />
					</Pressable>
				)}
			/>

			{!!error && (
				<Text className="text-danger mt-1.5" style={{ fontSize: tf.sm }}>
					{error}
				</Text>
			)}

			{/* A contact created here is selected straight away — creating one and
			    then having to find it in the list again is a step with no purpose. */}
			<ContactSheet
				key={creating ? "contact-new-open" : "contact-new-closed"}
				visible={creating}
				onClose={() => setCreating(false)}
				onSubmit={(draft) => onChange(addContact(draft).id)}
			/>

			<ContactImportSheet
				key={importing ? "contact-import-open" : "contact-import-closed"}
				visible={importing}
				onClose={() => setImporting(false)}
				onImport={importContacts}
				existing={contacts}
			/>
		</View>
	);
}
