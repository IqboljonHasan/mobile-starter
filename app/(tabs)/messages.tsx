import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Alert, Platform, ScrollView, Switch, Text, View } from "react-native";
import TabHeader from "@/components/TabHeader";
import { Badge, Button, Card, IconButton, ListRow } from "@/components/ui";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useSmsScheduler } from "@/hooks/useSmsScheduler";
import { useTheme } from "@/hooks/useTheme";
import {
	describeNextRun,
	describeSchedule,
	formatDateTime,
	STATUS_LABELS,
	statusTone,
} from "@/lib/sms";
import {
	cancelSchedule,
	clearLog,
	openBatteryOptimizationSettings,
	openExactAlarmSettings,
	setScheduleEnabled,
} from "@/modules/sms-scheduler";
import "../../global.css";

export default function MessagesScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("messages");
	const {
		available,
		loading,
		schedules,
		log,
		permission,
		exactAlarms,
		batteryExempt,
		refresh,
		askForPermission,
	} = useSmsScheduler();

	const toggle = async (id: string, enabled: boolean) => {
		try {
			await setScheduleEnabled(id, enabled);
			await refresh();
		} catch (e) {
			Alert.alert("Couldn't update", String(e));
		}
	};

	const remove = (id: string, label: string) => {
		Alert.alert("Delete schedule?", `"${label}" won't be sent.`, [
			{ text: "Keep", style: "cancel" },
			{
				text: "Delete",
				style: "destructive",
				onPress: async () => {
					await cancelSchedule(id);
					await refresh();
				},
			},
		]);
	};

	if (!available) {
		return (
			<View className="flex-1 bg-background">
				<TabHeader title="Messages" subtitle="Scheduled SMS" />
				<ScrollView {...shadow} contentContainerStyle={{ padding: 16, gap: 12 }}>
					<Card title="Not available here">
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.base }}
						>
							{Platform.OS === "android"
								? "Scheduled sending needs a native build — the module isn't in Expo Go. Run `bun run android` once, then reopen the app."
								: "Sending SMS without user interaction is an Android capability; iOS has no equivalent API. This tab is Android-only."}
						</Text>
					</Card>
				</ScrollView>
			</View>
		);
	}

	const granted = permission?.granted ?? false;
	// Anything unresolved here is a reason a schedule might silently not fire,
	// so it goes above the list rather than in Settings.
	const needsSetup = !granted || !exactAlarms || !batteryExempt;

	return (
		<View className="flex-1 bg-background">
			<TabHeader
				title="Messages"
				subtitle={
					schedules.length === 1
						? "1 schedule"
						: `${schedules.length} schedules`
				}
				headerRight={
					<IconButton
						icon="add"
						accessibilityLabel="New schedule"
						onPress={() => router.push("/schedule")}
					/>
				}
			/>

			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12 }}
				showsVerticalScrollIndicator={false}
			>
				{needsSetup && (
					<Card
						title="Before this can send"
						subtitle="Each of these can stop a scheduled message on its own"
						flush
					>
						{!granted && (
							<ListRow
								title="SMS permission"
								subtitle="Required — the app sends through your SIM"
								icon="chatbubble-ellipses-outline"
								danger
								trailing={
									<Button
										label="Grant"
										size="sm"
										onPress={async () => {
											const result = await askForPermission();
											if (result && !result.granted && !result.canAskAgain) {
												Alert.alert(
													"Permission blocked",
													"Android won't ask again. Enable SMS for this app in system settings.",
												);
											}
										}}
									/>
								}
							/>
						)}
						{!exactAlarms && (
							<ListRow
								title="Alarms & reminders"
								subtitle="Without it Android may delay a send by several minutes"
								icon="alarm-outline"
								divider={!granted}
								trailing={
									<Button
										label="Allow"
										size="sm"
										variant="soft"
										onPress={() => openExactAlarmSettings()}
									/>
								}
							/>
						)}
						{!batteryExempt && (
							<ListRow
								title="Battery optimisation"
								subtitle="Exempt this app so alarms survive deep sleep"
								icon="battery-charging-outline"
								divider={!granted || !exactAlarms}
								trailing={
									<Button
										label="Open"
										size="sm"
										variant="soft"
										color="secondary"
										onPress={() => openBatteryOptimizationSettings()}
									/>
								}
							/>
						)}
					</Card>
				)}

				{schedules.length === 0 && !loading && (
					<Card>
						<View className="items-center py-6 gap-3">
							<View className="w-14 h-14 rounded-full items-center justify-center bg-primary-highlight">
								<Ionicons name="time-outline" size={26} color={tc.primary} />
							</View>
							<Text
								className="font-semibold text-foreground"
								style={{ fontSize: tf.lg }}
							>
								No schedules yet
							</Text>
							<Text
								className="text-muted-foreground text-center"
								style={{ fontSize: tf.base }}
							>
								Add one and it will be sent at that time, in the background,
								whether or not the app is open.
							</Text>
							<Button
								label="New schedule"
								startIcon={<Ionicons name="add" size={18} color="#fff" />}
								onPress={() => router.push("/schedule")}
							/>
						</View>
					</Card>
				)}

				{schedules.map((schedule) => (
					<Card
						key={schedule.id}
						onPress={() => router.push(`/schedule?id=${schedule.id}`)}
					>
						<View className="flex-row items-start gap-3">
							<View className="flex-1">
								<View className="flex-row items-center gap-2 flex-wrap">
									<Text
										className="font-semibold text-foreground"
										style={{ fontSize: tf.lg }}
										numberOfLines={1}
									>
										{schedule.recipients.join(", ")}
									</Text>
									{schedule.lastStatus && (
										<Badge
											label={STATUS_LABELS[schedule.lastStatus]}
											tone={statusTone(schedule.lastStatus)}
										/>
									)}
								</View>
								<Text
									className="text-muted-foreground mt-1"
									style={{ fontSize: tf.base }}
									numberOfLines={2}
								>
									{schedule.body}
								</Text>
							</View>
							<Switch
								value={schedule.enabled}
								onValueChange={(next) => toggle(schedule.id, next)}
								trackColor={{ false: tc.disabled, true: tc.primary }}
								thumbColor="#fff"
							/>
						</View>

						<View className="mt-3 rounded-xl bg-muted p-3 gap-1">
							<View className="flex-row items-center gap-2">
								<Ionicons
									name="repeat-outline"
									size={14}
									color={tc.mutedForeground}
								/>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									{describeSchedule(schedule)}
								</Text>
							</View>
							<View className="flex-row items-center gap-2">
								<Ionicons
									name="time-outline"
									size={14}
									color={tc.mutedForeground}
								/>
								<Text
									className="text-muted-foreground"
									style={{ fontSize: tf.sm }}
								>
									{describeNextRun(schedule)}
								</Text>
							</View>
							{!!schedule.lastError && (
								<View className="flex-row items-center gap-2">
									<Ionicons
										name="alert-circle-outline"
										size={14}
										color={tc.danger}
									/>
									<Text className="text-danger" style={{ fontSize: tf.sm }}>
										{schedule.lastError}
									</Text>
								</View>
							)}
						</View>

						<View className="flex-row gap-2 mt-3">
							<Button
								label="Edit"
								size="sm"
								variant="soft"
								color="secondary"
								onPress={() => router.push(`/schedule?id=${schedule.id}`)}
							/>
							<Button
								label="Delete"
								size="sm"
								variant="text"
								color="danger"
								onPress={() =>
									remove(schedule.id, schedule.recipients.join(", "))
								}
							/>
						</View>
					</Card>
				))}

				{log.length > 0 && (
					<Card
						flush
						title="Recent sends"
						headerRight={
							<Button
								label="Clear"
								size="sm"
								variant="text"
								color="secondary"
								onPress={async () => {
									await clearLog();
									await refresh();
								}}
							/>
						}
					>
						{log.slice(0, 12).map((entry, index) => (
							<ListRow
								key={entry.id}
								title={entry.recipient}
								subtitle={`${formatDateTime(entry.createdAt)}${
									entry.parts > 1 ? ` · ${entry.parts} parts` : ""
								}${entry.error ? ` · ${entry.error}` : ""}`}
								divider={index > 0}
								icon={
									entry.status === "sent"
										? "checkmark-circle-outline"
										: entry.status === "failed"
											? "close-circle-outline"
											: "ellipsis-horizontal-circle-outline"
								}
								danger={entry.status === "failed"}
								trailing={
									<Badge
										label={STATUS_LABELS[entry.status]}
										tone={statusTone(entry.status)}
									/>
								}
							/>
						))}
					</Card>
				)}
			</ScrollView>
		</View>
	);
}
