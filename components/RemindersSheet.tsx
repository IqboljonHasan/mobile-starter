import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, View } from "react-native";
import ContactAvatar from "@/components/ContactAvatar";
import { BottomSheet, Button, Chip, FieldLabel, IconButton, Toggle } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useLedger } from "@/contexts/LedgerContext";
import {
	REMINDER_DAY_OPTIONS,
	REMINDER_HOUR_OPTIONS,
	usePreferences,
} from "@/contexts/PreferencesContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { formatDayMonth, toISODate } from "@/lib/date";
import {
	type ReminderPermission,
	reminderPermission,
	requestReminderPermission,
	upcomingReminders,
} from "@/lib/debtReminders";
import { contactName, remainingAmount } from "@/lib/debts";
import { formatAmount } from "@/lib/money";

const DAY_LABELS: Record<number, string> = { 0: "Muddat kuni", 1: "1 kun oldin", 3: "3 kun oldin" };

const hourLabel = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/**
 * Debt reminders, from the Qarzlar menu: whether they go off at all, how long
 * before the due date and at what hour, and what is already lined up. Which
 * debts are reminded about is each debt's own switch, on its form.
 */
export default function RemindersSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const { debts, contacts } = useLedger();
	const { reminders, setReminders } = usePreferences();
	const [permission, setPermission] = useState<ReminderPermission | null>(null);

	useEffect(() => {
		if (visible) reminderPermission().then(setPermission);
	}, [visible]);

	const upcoming = useMemo(() => upcomingReminders(debts, reminders), [debts, reminders]);

	const ask = async () => setPermission(await requestReminderPermission());

	return (
		<BottomSheet visible={visible} onClose={onClose} maxHeight="88%">
			<View className="flex-row items-center justify-between gap-3" style={{ paddingLeft: 20, paddingRight: 12 }}>
				<Text
					accessibilityRole="header"
					className="font-extrabold text-foreground"
					style={{ fontSize: tf.xl, letterSpacing: -0.2 }}
				>
					Eslatmalar
				</Text>
				<IconButton variant="filled" icon="close" accessibilityLabel="Yopish" onPress={onClose} />
			</View>

			<ScrollView
				style={{ flexShrink: 1 }}
				contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, gap: 16 }}
			>
				<View
					className="flex-row items-center bg-card"
					style={{ borderRadius: 20, minHeight: 60, gap: 12, paddingLeft: 14, paddingRight: 8 }}
				>
					<View
						className="items-center justify-center bg-background"
						style={{ width: 32, height: 32, borderRadius: 10 }}
					>
						<Ionicons name="notifications-outline" size={18} color={tc.foreground} />
					</View>
					<View className="flex-1 gap-px">
						<Text className="font-bold text-foreground" style={{ fontSize: tf.base }}>
							Qarz eslatmalari
						</Text>
						<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1 }}>
							Muddat yaqinlashganda bildirishnoma
						</Text>
					</View>
					<Toggle
						value={reminders.enabled}
						accessibilityLabel="Qarz eslatmalari"
						onValueChange={(enabled) => {
							setReminders({ ...reminders, enabled });
							if (enabled) ask();
						}}
					/>
				</View>

				{reminders.enabled && permission && permission !== "granted" && (
					<View className="bg-warning-soft gap-3" style={{ borderRadius: 20, padding: 14 }}>
						<View className="flex-row items-start gap-3">
							<Ionicons name="notifications-off-outline" size={20} color={tc.warning} />
							<Text className="flex-1 font-semibold text-foreground" style={{ fontSize: tf.sm }}>
								{permission === "unavailable"
									? "Eslatmalar ilovaning yangi versiyasida ishlaydi — ilovani yangilang."
									: "Bildirishnomalarga ruxsat berilmagan, shuning uchun eslatmalar kelmaydi."}
							</Text>
						</View>
						{permission === "undetermined" && (
							<Button label="Ruxsat berish" size="sm" onPress={ask} />
						)}
						{permission === "denied" && (
							<Button
								label="Telefon sozlamalarini ochish"
								size="sm"
								onPress={() => Linking.openSettings()}
							/>
						)}
					</View>
				)}

				<View style={{ opacity: reminders.enabled ? 1 : 0.45 }} pointerEvents={reminders.enabled ? "auto" : "none"}>
					<FieldLabel>Qachon</FieldLabel>
					<View accessibilityRole="radiogroup" className="flex-row flex-wrap" style={{ gap: 6 }}>
						{REMINDER_DAY_OPTIONS.map((days) => (
							<Chip
								key={days}
								size="sm"
								role="radio"
								label={DAY_LABELS[days]}
								active={reminders.daysBefore === days}
								onPress={() => setReminders({ ...reminders, daysBefore: days })}
							/>
						))}
					</View>

					<FieldLabel className="mt-4">Soat</FieldLabel>
					<View accessibilityRole="radiogroup" className="flex-row flex-wrap" style={{ gap: 6 }}>
						{REMINDER_HOUR_OPTIONS.map((hour) => (
							<Chip
								key={hour}
								size="sm"
								role="radio"
								label={hourLabel(hour)}
								active={reminders.hour === hour}
								onPress={() => setReminders({ ...reminders, hour })}
							/>
						))}
					</View>
				</View>

				<View>
					<FieldLabel>Rejalashtirilgan</FieldLabel>
					{upcoming.length === 0 ? (
						<Text className="font-semibold text-muted-foreground ml-1" style={{ fontSize: tf.sm }}>
							{reminders.enabled
								? "Muddati belgilangan va eslatmasi yoqilgan ochiq qarz yo'q."
								: "Eslatmalar o'chirilgan."}
						</Text>
					) : (
						<View className="bg-card overflow-hidden" style={{ borderRadius: 20 }}>
							{upcoming.map(({ debt, at }, index) => {
								const name = contactName(contacts, debt.contactId);
								return (
									<Pressable
										key={debt.id}
										accessibilityRole="button"
										onPress={() => {
											onClose();
											setTimeout(() => router.push(`/debt?id=${debt.id}`), 280);
										}}
										className={`flex-row items-center gap-3 active:opacity-70 ${index > 0 ? "border-t border-border" : ""}`}
										style={{ paddingHorizontal: 14, paddingVertical: 10 }}
									>
										<ContactAvatar name={name} id={debt.contactId} size={36} mono />
										<View className="flex-1 gap-px">
											<Text className="font-bold text-foreground" style={{ fontSize: tf.base }} numberOfLines={1}>
												{name}
											</Text>
											<Text className="font-semibold text-muted-foreground" style={{ fontSize: tf.sm - 1 }}>
												{`${formatDayMonth(toISODate(at))}, ${hourLabel(at.getHours())}`}
											</Text>
										</View>
										<Text
											className="font-extrabold"
											style={{ fontSize: tf.sm + 1, color: debt.direction === "lent" ? tc.success : tc.danger }}
										>
											{formatAmount(remainingAmount(debt), debt.unit)}
										</Text>
									</Pressable>
								);
							})}
						</View>
					)}
				</View>
			</ScrollView>
		</BottomSheet>
	);
}
