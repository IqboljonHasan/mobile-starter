import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { BottomSheet, Button, InputField, Textarea } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import type { Contact, ContactDraft } from "@/lib/types";

/**
 * Adds or edits one person. Opened from the contacts screen and from the
 * picker inside the debt form, so a debt can be recorded for somebody who
 * isn't in the app yet without leaving the form.
 *
 * Its fields are seeded on mount, so give it a `key` that changes when it
 * opens — the same idiom `TransferSheet` is mounted with.
 */
export default function ContactSheet({
	visible,
	onClose,
	onSubmit,
	existing,
	/** Pre-fills the name — what the user had already typed when they asked to
	 *  create somebody new. */
	initialName = "",
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (draft: ContactDraft) => void;
	existing?: Contact | null;
	initialName?: string;
}) {
	const { tf } = useFont();

	const [name, setName] = useState(existing?.name ?? initialName);
	const [phone, setPhone] = useState(existing?.phone ?? "");
	const [note, setNote] = useState(existing?.note ?? "");
	const [submitted, setSubmitted] = useState(false);

	const nameError = name.trim() ? undefined : "Ismni kiriting";

	const submit = () => {
		setSubmitted(true);
		if (nameError) return;
		onSubmit({
			name: name.trim(),
			phone: phone.trim(),
			note: note.trim(),
			// An edited contact keeps whatever address-book link it arrived with;
			// one typed in here has none until an import matches it by number.
			sourceId: existing?.sourceId ?? null,
		});
		onClose();
	};

	return (
		<BottomSheet visible={visible} onClose={onClose} maxHeight="90%">
			<ScrollView
				contentContainerStyle={{ padding: 16, gap: 16 }}
				keyboardShouldPersistTaps="handled"
			>
				<Text className="font-bold text-foreground" style={{ fontSize: tf.xl }}>
					{existing ? "Kontaktni tahrirlash" : "Yangi kontakt"}
				</Text>

				<InputField
					label="Ism"
					required
					value={name}
					onChangeText={setName}
					placeholder="Masalan, Alisher"
					autoFocus={!existing}
					error={submitted ? nameError : undefined}
				/>

				<InputField
					label="Telefon"
					value={phone}
					onChangeText={setPhone}
					placeholder="+998 90 123 45 67"
					keyboardType="phone-pad"
					inputMode="tel"
					hint="Ixtiyoriy"
				/>

				<Textarea
					label="Izoh"
					rows={2}
					value={note}
					onChangeText={setNote}
					placeholder="Ixtiyoriy"
				/>

				<View className="flex-row gap-3">
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
						<Button label="Saqlash" fullWidth onPress={submit} />
					</View>
				</View>
			</ScrollView>
		</BottomSheet>
	);
}
