import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	Alert,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	ScrollView,
	Text,
	View,
} from "react-native";
import {
	Button,
	Card,
	InputField,
	SegmentedControl,
	Select,
	Textarea,
} from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useSmsScheduler } from "@/hooks/useSmsScheduler";
import { useTheme } from "@/hooks/useTheme";
import {
	combineDateAndTime,
	dayLabel,
	formatTime,
	segmentInfo,
	upcomingDays,
	WEEKDAYS,
} from "@/lib/sms";
import {
	cancelSchedule,
	listSchedules,
	type RepeatMode,
	saveSchedule,
	sendNow,
	type Weekday,
} from "@/modules/sms-scheduler";
import "../global.css";

const REPEAT_ITEMS: { key: RepeatMode; label: string }[] = [
	{ key: "none", label: "Once" },
	{ key: "daily", label: "Daily" },
	{ key: "weekly", label: "Weekly" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => ({
	key: h,
	label: String(h).padStart(2, "0"),
}));
const MINUTES = Array.from({ length: 60 }, (_, m) => ({
	key: m,
	label: String(m).padStart(2, "0"),
}));

export default function ScheduleScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { sims, permission, askForPermission, refresh } = useSmsScheduler();
	const editing = !!id;

	const [recipients, setRecipients] = useState<string[]>([]);
	const [draftRecipient, setDraftRecipient] = useState("");
	const [body, setBody] = useState("");
	const [repeat, setRepeat] = useState<RepeatMode>("none");
	const [hour, setHour] = useState(9);
	const [minute, setMinute] = useState(0);
	const [days, setDays] = useState<Weekday[]>([]);
	const [dayOffset, setDayOffset] = useState(0);
	const [subscriptionId, setSubscriptionId] = useState(-1);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Seeded once from a direct read rather than from the shared hook's list:
	// that list re-resolves on every scheduler event, and re-seeding from it
	// would throw away whatever the user had typed since.
	const seeded = useRef(false);
	useEffect(() => {
		if (!id || seeded.current) return;
		let cancelled = false;

		(async () => {
			const existing = (await listSchedules()).find((s) => s.id === id);
			if (cancelled || !existing) return;
			seeded.current = true;

			setRecipients(existing.recipients);
			setBody(existing.body);
			setRepeat(existing.repeat);
			setHour(existing.hour);
			setMinute(existing.minute);
			setDays(existing.daysOfWeek);
			setSubscriptionId(existing.subscriptionId);

			if (existing.repeat === "none" && existing.triggerAt) {
				const target = new Date(existing.triggerAt);
				target.setHours(0, 0, 0, 0);
				const today = new Date();
				today.setHours(0, 0, 0, 0);
				const offset = Math.round(
					(target.getTime() - today.getTime()) / 86_400_000,
				);
				setDayOffset(Math.max(0, offset));
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [id]);

	const dayOptions = useMemo(() => upcomingDays(60), []);
	const segments = segmentInfo(body);

	const addRecipient = () => {
		const value = draftRecipient.trim();
		if (!value) return;
		if (recipients.includes(value)) {
			setDraftRecipient("");
			return;
		}
		setRecipients((prev) => [...prev, value]);
		setDraftRecipient("");
	};

	const toggleDay = (day: Weekday) => {
		setDays((prev) =>
			prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
		);
	};

	// Pull the pending number in for the user rather than discarding what they
	// typed just because they didn't tap Add.
	const effectiveRecipients = useMemo(() => {
		const draft = draftRecipient.trim();
		if (!draft || recipients.includes(draft)) return recipients;
		return [...recipients, draft];
	}, [recipients, draftRecipient]);

	const ensurePermission = async () => {
		if (permission?.granted) return true;
		const result = await askForPermission();
		if (result?.granted) return true;
		Alert.alert(
			"SMS permission needed",
			result?.canAskAgain === false
				? "Android won't ask again — enable SMS for this app in system settings."
				: "The app can't send anything without it.",
		);
		return false;
	};

	const save = async () => {
		setError(null);
		if (effectiveRecipients.length === 0) {
			setError("Add at least one phone number.");
			return;
		}
		if (!body.trim()) {
			setError("Write the message to send.");
			return;
		}
		if (repeat === "weekly" && days.length === 0) {
			setError("Pick at least one weekday.");
			return;
		}
		if (!(await ensurePermission())) return;

		setSaving(true);
		try {
			await saveSchedule({
				id,
				recipients: effectiveRecipients,
				body: body.trim(),
				repeat,
				hour,
				minute,
				daysOfWeek: repeat === "weekly" ? days : [],
				triggerAt:
					repeat === "none"
						? combineDateAndTime(dayOptions[dayOffset], hour, minute)
						: 0,
				subscriptionId,
				enabled: true,
			});
			await refresh();
			router.back();
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(false);
		}
	};

	const sendTest = async () => {
		if (effectiveRecipients.length === 0 || !body.trim()) {
			setError("A number and a message are needed to send a test.");
			return;
		}
		if (!(await ensurePermission())) return;
		try {
			await sendNow(effectiveRecipients, body.trim(), subscriptionId);
			Alert.alert(
				"Handed to the network",
				"Check Recent sends on the Messages tab for the carrier's result.",
			);
			await refresh();
		} catch (e) {
			Alert.alert("Couldn't send", String(e));
		}
	};

	const remove = () => {
		if (!id) return;
		Alert.alert("Delete schedule?", "It won't be sent.", [
			{ text: "Keep", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await cancelSchedule(id);
					await refresh();
					router.back();
				},
			},
		]);
	};

	return (
		<KeyboardAvoidingView
			className="flex-1 bg-background"
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<Stack.Screen
				options={{ title: editing ? "Edit schedule" : "New schedule" }}
			/>
			<ScrollView
				contentContainerStyle={{ padding: 16, gap: 12 }}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				{/* Recipients ------------------------------------------------- */}
				<Card title="Send to" subtitle="Numbers in the format your carrier expects">
					<View className="flex-row items-end gap-2">
						<View className="flex-1">
							<InputField
								placeholder="+998 90 123 45 67"
								keyboardType="phone-pad"
								value={draftRecipient}
								onChangeText={setDraftRecipient}
								onSubmitEditing={addRecipient}
								returnKeyType="done"
							/>
						</View>
						<Button
							label="Add"
							variant="soft"
							onPress={addRecipient}
							disabled={!draftRecipient.trim()}
						/>
					</View>

					{recipients.length > 0 && (
						<View className="flex-row flex-wrap gap-2 mt-3">
							{recipients.map((number) => (
								<Pressable
									key={number}
									accessibilityRole="button"
									accessibilityLabel={`Remove ${number}`}
									onPress={() =>
										setRecipients((prev) => prev.filter((n) => n !== number))
									}
									className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-2 active:opacity-70"
								>
									<Text
										className="text-foreground font-medium"
										style={{ fontSize: tf.sm }}
									>
										{number}
									</Text>
									<Ionicons name="close" size={14} color={tc.mutedForeground} />
								</Pressable>
							))}
						</View>
					)}
				</Card>

				{/* Message ---------------------------------------------------- */}
				<Card
					title="Message"
					headerRight={
						<Text
							className={
								segments.segments > 1 ? "text-warning" : "text-muted-foreground"
							}
							style={{ fontSize: tf.sm }}
						>
							{segments.used}/{segments.capacity} · {segments.segments} SMS
						</Text>
					}
				>
					<Textarea
						placeholder="What should be sent?"
						rows={4}
						value={body}
						onChangeText={setBody}
					/>
					{segments.encoding === "UCS-2" && (
						<Text
							className="text-muted-foreground mt-2"
							style={{ fontSize: tf.sm }}
						>
							Non-Latin characters put this message in UCS-2, so each SMS holds
							70 characters instead of 160.
						</Text>
					)}
				</Card>

				{/* When ------------------------------------------------------- */}
				<Card title="When">
					<SegmentedControl
						items={REPEAT_ITEMS}
						value={repeat}
						onChange={setRepeat}
						className="bg-muted"
					/>

					<View className="flex-row gap-2 mt-4">
						<View className="flex-1">
							<Text
								className="font-medium text-foreground mb-1.5"
								style={{ fontSize: tf.base }}
							>
								Hour
							</Text>
							<Select
								label="Hour"
								value={hour}
								options={HOURS}
								toggleOff={false}
								onChange={(value) => value !== null && setHour(value)}
							/>
						</View>
						<View className="flex-1">
							<Text
								className="font-medium text-foreground mb-1.5"
								style={{ fontSize: tf.base }}
							>
								Minute
							</Text>
							<Select
								label="Minute"
								value={minute}
								options={MINUTES}
								toggleOff={false}
								onChange={(value) => value !== null && setMinute(value)}
							/>
						</View>
					</View>

					{repeat === "none" && (
						<View className="mt-3">
							<Text
								className="font-medium text-foreground mb-1.5"
								style={{ fontSize: tf.base }}
							>
								Day
							</Text>
							<Select
								label="Day"
								value={dayOffset}
								toggleOff={false}
								options={dayOptions.map((date, index) => ({
									key: index,
									label: dayLabel(date),
								}))}
								onChange={(value) => value !== null && setDayOffset(value)}
							/>
						</View>
					)}

					{repeat === "weekly" && (
						<View className="mt-3">
							<Text
								className="font-medium text-foreground mb-1.5"
								style={{ fontSize: tf.base }}
							>
								Repeat on
							</Text>
							<View className="flex-row gap-1.5">
								{WEEKDAYS.map((day) => {
									const active = days.includes(day.value);
									return (
										<Pressable
											key={day.value}
											accessibilityRole="button"
											accessibilityState={{ selected: active }}
											accessibilityLabel={day.long}
											onPress={() => toggleDay(day.value)}
											className={`flex-1 h-11 rounded-full items-center justify-center ${
												active ? "bg-primary" : "bg-muted"
											}`}
										>
											<Text
												className="font-semibold"
												style={{
													fontSize: tf.sm,
													color: active ? "#fff" : tc.mutedForeground,
												}}
											>
												{day.short[0]}
											</Text>
										</Pressable>
									);
								})}
							</View>
						</View>
					)}

					<Text
						className="text-muted-foreground mt-3"
						style={{ fontSize: tf.sm }}
					>
						{repeat === "none"
							? `Sends once, ${dayLabel(dayOptions[dayOffset]).toLowerCase()} at ${formatTime(hour, minute)}.`
							: repeat === "daily"
								? `Sends every day at ${formatTime(hour, minute)}.`
								: `Sends at ${formatTime(hour, minute)} on the days above.`}
					</Text>
				</Card>

				{/* SIM -------------------------------------------------------- */}
				{sims.length > 1 && (
					<Card title="SIM" subtitle="Which line the message is sent from">
						<Select
							label="SIM"
							value={subscriptionId}
							toggleOff={false}
							options={[
								{ key: -1, label: "Default SIM" },
								...sims.map((sim) => ({
									key: sim.subscriptionId,
									label:
										sim.displayName ??
										sim.carrierName ??
										`SIM ${sim.slotIndex + 1}`,
								})),
							]}
							onChange={(value) => setSubscriptionId(value ?? -1)}
						/>
					</Card>
				)}

				{!!error && (
					<View className="rounded-xl bg-danger/15 p-3">
						<Text className="text-danger" style={{ fontSize: tf.base }}>
							{error}
						</Text>
					</View>
				)}

				<View className="gap-2">
					<Button
						label={editing ? "Save changes" : "Schedule it"}
						fullWidth
						loading={saving}
						onPress={save}
					/>
					<Button
						label="Send now as a test"
						variant="outline"
						color="secondary"
						fullWidth
						onPress={sendTest}
					/>
					{!!editing && (
						<Button
							label="Delete schedule"
							variant="text"
							color="danger"
							fullWidth
							onPress={remove}
						/>
					)}
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}
