import { Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, InputField, ListRow, PasswordField, Toggle } from "@/components/ui";
import ScrollShadow from "@/components/ScrollShadow";
import { useTelegramBackup } from "@/contexts/TelegramBackupContext";
import { useFont } from "@/hooks/useFont";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import { useTheme } from "@/hooks/useTheme";
import { useScrolled } from "@/hooks/useScrolled";
import { describeTelegramStatus, validateTelegramConfig } from "@/lib/telegramBackup";
import "../global.css";

/**
 * Connecting the Telegram backup: the bot token and chat it sends to, whether
 * it goes daily, and a button to send one now. Saving sends a backup straight
 * away, so a wrong token or chat shows up here rather than as a silent miss
 * tomorrow.
 */
export default function TelegramScreen() {
	const { tc } = useTheme();
	const { loaded } = useTelegramBackup();

	return (
		<>
			<Stack.Screen options={{ title: "Telegram zaxira" }} />
			{loaded ? (
				<TelegramForm />
			) : (
				<View className="flex-1 bg-background items-center justify-center">
					<ActivityIndicator color={tc.foreground} />
				</View>
			)}
		</>
	);
}

const STEPS = [
	"Telegramda @BotFather'ga /newbot yuboring va u bergan tokenni nusxalang.",
	"Yangi botingizni oching va Start (/start) tugmasini bosing.",
	"Chat ID'ingizni bilish uchun @userinfobot'ga yozing — u ID raqamingizni qaytaradi.",
];

/** Mounted once the stored settings are read, so the fields start from them. */
function TelegramForm() {
	const { tc } = useTheme();
	const { tf } = useFont();
	const insets = useSafeAreaInsets();
	const keyboardInset = useKeyboardInset();
	const { config, status, configured, sending, saveConfig, sendNow } = useTelegramBackup();

	const [token, setToken] = useState(config.token);
	const { scrolled, scrollProps } = useScrolled();
	const [chatId, setChatId] = useState(config.chatId);
	const [errors, setErrors] = useState<{ token?: string; chatId?: string }>({});
	// The save button's own spinner: once saved the fields stop being dirty,
	// and `sending` alone would move the spinner to the row below mid-send.
	const [testing, setTesting] = useState(false);

	const draft = { ...config, token: token.trim(), chatId: chatId.trim() };
	const dirty = draft.token !== config.token || draft.chatId !== config.chatId;

	const saveAndTest = async () => {
		const found = validateTelegramConfig(draft.token, draft.chatId);
		setErrors(found);
		if (found.token || found.chatId) return;

		setTesting(true);
		let result;
		try {
			await saveConfig(draft);
			result = await sendNow();
		} finally {
			setTesting(false);
		}
		if (result.ok) {
			Alert.alert(
				"Ulandi",
				"Zaxira nusxa Telegramga yuborildi." +
					(draft.auto ? " Bundan buyon har kuni o'zi yuboriladi." : ""),
			);
		} else {
			Alert.alert("Saqlandi, lekin yuborilmadi", result.error);
		}
	};

	const runSend = async () => {
		const result = await sendNow();
		Alert.alert(
			result.ok ? "Yuborildi" : "Yuborilmadi",
			result.ok ? "Zaxira nusxa Telegramga yuborildi." : result.error,
		);
	};

	const confirmDisconnect = () => {
		Alert.alert(
			"Telegram uzilsinmi?",
			"Bot tokeni va chat ID o'chiriladi, kunlik zaxira to'xtaydi. Chatdagi avvalgi zaxiralar o'z joyida qoladi.",
			[
				{ text: "Bekor qilish", style: "cancel" },
				{
					text: "Uzish",
					style: "destructive",
					onPress: async () => {
						await saveConfig({ ...config, token: "", chatId: "" });
						setToken("");
						setChatId("");
						setErrors({});
					},
				},
			],
		);
	};

	return (
		<View className="flex-1 bg-background">
			<ScrollView
				{...scrollProps}
				className="flex-1 bg-background"
				contentContainerStyle={{
					paddingHorizontal: 18,
					paddingTop: 4,
					gap: 12,
					paddingBottom: 40 + Math.max(0, keyboardInset - insets.bottom),
				}}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Card title="Qanday ulanadi">
					<View className="gap-2">
						{STEPS.map((step, i) => (
							<View key={step} className="flex-row gap-3">
								<View className="w-6 h-6 rounded-full items-center justify-center bg-primary-highlight">
									<Text className="font-semibold text-primary" style={{ fontSize: tf.xs }}>
										{i + 1}
									</Text>
								</View>
								<Text className="flex-1 text-secondary-foreground" style={{ fontSize: tf.sm }}>
									{step}
								</Text>
							</View>
						))}
					</View>
				</Card>

				<Card title="Bot">
					<View className="gap-3">
						<PasswordField
							label="Bot tokeni"
							value={token}
							onChangeText={setToken}
							placeholder="123456789:AAH..."
							autoCapitalize="none"
							autoCorrect={false}
							autoComplete="off"
							error={errors.token}
						/>
						<InputField
							label="Chat ID"
							value={chatId}
							onChangeText={setChatId}
							placeholder="123456789"
							autoCapitalize="none"
							autoCorrect={false}
							autoComplete="off"
							error={errors.chatId}
							hint="Guruh yoki kanalga yuborish uchun botni o'sha yerga qo'shing."
						/>
						<Button
							label={configured ? "Saqlash va tekshirish" : "Ulash va tekshirish"}
							onPress={saveAndTest}
							loading={testing}
							disabled={!dirty || sending}
							fullWidth
						/>
					</View>
				</Card>

				<Card flush title="Zaxira">
					<ListRow
						title="Har kuni avtomatik"
						subtitle="Kuniga bir marta .db fayl chatga o'zi yuboriladi"
						icon="time-outline"
						trailing={
							<Toggle
								value={config.auto}
								onValueChange={(auto) => saveConfig({ ...config, auto })}
								accessibilityLabel="Har kuni avtomatik"
							/>
						}
					/>
					<ListRow
						title="Hozir yuborish"
						subtitle={
							configured
								? describeTelegramStatus(config, status)
								: "Avval botni ulang"
						}
						icon="paper-plane-outline"
						divider
						onPress={configured && !dirty && !sending ? runSend : undefined}
						trailing={
							sending && !testing ? <ActivityIndicator color={tc.foreground} /> : undefined
						}
					/>
				</Card>

				{configured && (
					<Card flush>
						<ListRow
							title="Telegramni uzish"
							subtitle="Token va chat ID o'chiriladi"
							icon="unlink-outline"
							danger
							onPress={confirmDisconnect}
						/>
					</Card>
				)}

				<Text
					className="text-muted-foreground text-center px-6 pt-1"
					style={{ fontSize: tf.xs }}
				>
					{"Kunlik zaxira ilova ochilganda yoki telefon fonda ruxsat berganda yuboriladi. Fayl \"Fayldan tiklash\" orqali qayta tiklanadi."}
				</Text>
			</ScrollView>
			<ScrollShadow visible={scrolled} />
		</View>
	);
}
