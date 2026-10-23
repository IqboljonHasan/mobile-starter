import { useState } from "react";
import { ScrollView, View } from "react-native";
import { BottomSheet, Button, InputField, Toggle } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";

/**
 * Names the entry form's current state as a template. The name is the one
 * thing asked — it's what the quick-pick chip will say — and the amount is
 * kept only if the user wants it: a salary repeats its figure, a grocery run
 * doesn't.
 *
 * Its fields are seeded on mount, so give it a `key` that changes when it
 * opens, as with the other sheets.
 */
export default function TemplateSheet({
	visible,
	onClose,
	onSubmit,
	initialName,
	summary,
	hasAmount,
}: {
	visible: boolean;
	onClose: () => void;
	onSubmit: (name: string, keepAmount: boolean) => void;
	initialName: string;
	/** What is being kept, in one line — "Oziq-ovqat / Bozorlik · 185 000 so'm". */
	summary: string;
	/** Whether the form holds an amount that could be kept. */
	hasAmount: boolean;
}) {
	const { tf } = useFont();
	const [name, setName] = useState(initialName);
	const [keepAmount, setKeepAmount] = useState(hasAmount);
	const [submitted, setSubmitted] = useState(false);
	const nameError = name.trim() ? undefined : "Nom kiriting";

	const submit = () => {
		setSubmitted(true);
		if (nameError) return;
		onSubmit(name.trim(), hasAmount && keepAmount);
		onClose();
	};

	return (
		<BottomSheet visible={visible} onClose={onClose} maxHeight="90%">
			<ScrollView contentContainerStyle={{ padding: 18, paddingTop: 4, gap: 16 }} keyboardShouldPersistTaps="handled">
				<View className="gap-1">
					<Text className="font-extrabold text-foreground" style={{ fontSize: tf.xl }}>
						Shablon sifatida saqlash
					</Text>
					<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm }}>
						{summary}
					</Text>
				</View>

				<InputField
					label="Nomi"
					required
					value={name}
					onChangeText={setName}
					placeholder="Masalan, Oylik maosh"
					autoFocus
					maxLength={40}
					error={submitted ? nameError : undefined}
					hint="Formadagi tezkor tanlash qatorida shu nom bilan chiqadi"
				/>

				{hasAmount && (
					<View
						className="flex-row items-center bg-card"
						style={{ borderRadius: 20, minHeight: 56, gap: 12, paddingLeft: 14, paddingRight: 8 }}
					>
						<View className="flex-1 gap-px">
							<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
								Summani ham saqlash
							</Text>
							<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1 }}>
								{keepAmount ? "Har safar shu summa qo'yiladi" : "Summa har safar kiritiladi"}
							</Text>
						</View>
						<Toggle value={keepAmount} onValueChange={setKeepAmount} accessibilityLabel="Summani ham saqlash" />
					</View>
				)}

				<View className="flex-row gap-3">
					<View className="flex-1">
						<Button label="Bekor qilish" variant="soft" color="secondary" fullWidth onPress={onClose} />
					</View>
					<View className="flex-1">
						<Button label="Saqlash" fullWidth onPress={submit} />
					</View>
				</View>
			</ScrollView>
		</BottomSheet>
	);
}
