import type * as NotificationsApi from "expo-notifications";
import { Platform } from "react-native";
import type { ReminderSettings } from "@/contexts/PreferencesContext";
import { addDaysISO, formatDayMonth, fromISODate, todayISO } from "@/lib/date";
import { contactName, debtStatus, remainingAmount } from "@/lib/debts";
import { formatAmount } from "@/lib/money";
import type { Contact, Debt } from "@/lib/types";

/**
 * Local notifications ahead of a debt's due date.
 *
 * The scheduled set is never edited piece by piece: `syncDebtReminders`
 * cancels every reminder this app scheduled and schedules the current set
 * again from the debts as they stand. Whatever changed — a payment that
 * settled a debt, a moved due date, a deleted contact, the settings — the
 * phone ends up holding exactly what the ledger says, with no bookkeeping
 * that could drift.
 */

type Api = typeof NotificationsApi;

/** Marks our notifications, so a sync only ever cancels its own. */
const KIND = "debt-reminder";
const CHANNEL = "debt-reminders";

let api: Api | null | undefined;

/**
 * The notifications module, or null when the build in use doesn't carry its
 * native half — a JS reload onto an install made before it was added. Then
 * reminders quietly do nothing until the next native build, rather than the
 * whole app failing to start.
 */
function notifications(): Api | null {
	if (api === undefined) {
		try {
			// eslint-disable-next-line @typescript-eslint/no-require-imports
			api = require("expo-notifications") as Api;
		} catch (e) {
			console.warn("[reminders] notifications unavailable in this build", e);
			api = null;
		}
	}
	return api;
}

/** When a debt's reminder goes off, in local time. */
export function reminderDate(debt: Debt, settings: ReminderSettings): Date | null {
	if (!debt.dueDate) return null;
	const date = fromISODate(addDaysISO(debt.dueDate, -settings.daysBefore));
	date.setHours(settings.hour, 0, 0, 0);
	return date;
}

/** Open debts with a reminder still ahead of them, soonest first. */
export function upcomingReminders(
	debts: Debt[],
	settings: ReminderSettings,
	now: Date = new Date(),
): { debt: Debt; at: Date }[] {
	if (!settings.enabled) return [];
	const today = todayISO();
	return debts
		.filter((d) => d.remind && d.dueDate && debtStatus(d, today) !== "settled")
		.map((debt) => ({ debt, at: reminderDate(debt, settings) as Date }))
		.filter((r) => r.at.getTime() > now.getTime())
		.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** "ertaga", "bugun", "3 kundan keyin" — how far off the due date is when the reminder lands. */
function whenWord(daysBefore: number): string {
	if (daysBefore === 0) return "bugun";
	if (daysBefore === 1) return "ertaga";
	return `${daysBefore} kundan keyin`;
}

export function reminderText(
	debt: Debt,
	name: string,
	settings: ReminderSettings,
): { title: string; body: string } {
	const amount = formatAmount(remainingAmount(debt), debt.unit);
	const due = debt.dueDate ? formatDayMonth(debt.dueDate) : "";
	const when = whenWord(settings.daysBefore);
	return debt.direction === "lent"
		? {
				title: "Qarz qaytishi kerak",
				body: `${name} ${when} (${due}) ${amount} qaytarishi kerak.`,
			}
		: {
				title: "Qarzni qaytarish vaqti",
				body: `${name}ga ${when} (${due}) ${amount} qaytarishingiz kerak.`,
			};
}

/** Brings the phone's scheduled reminders in line with the debts. */
export async function syncDebtReminders(
	debts: Debt[],
	contacts: Contact[],
	settings: ReminderSettings,
): Promise<void> {
	const N = notifications();
	if (!N) return;

	const scheduled = await N.getAllScheduledNotificationsAsync();
	await Promise.all(
		scheduled
			.filter((r) => r.content.data?.kind === KIND)
			.map((r) => N.cancelScheduledNotificationAsync(r.identifier)),
	);

	const upcoming = upcomingReminders(debts, settings);
	if (upcoming.length === 0) return;
	if (!(await N.getPermissionsAsync()).granted) return;

	if (Platform.OS === "android") {
		await N.setNotificationChannelAsync(CHANNEL, {
			name: "Qarz eslatmalari",
			importance: N.AndroidImportance.DEFAULT,
		});
	}

	for (const { debt, at } of upcoming) {
		const { title, body } = reminderText(debt, contactName(contacts, debt.contactId), settings);
		await N.scheduleNotificationAsync({
			identifier: `debt-${debt.id}`,
			content: { title, body, data: { kind: KIND, debtId: debt.id } },
			trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
		});
	}
}

export type ReminderPermission = "granted" | "denied" | "undetermined" | "unavailable";

export async function reminderPermission(): Promise<ReminderPermission> {
	const N = notifications();
	if (!N) return "unavailable";
	try {
		const status = await N.getPermissionsAsync();
		if (status.granted) return "granted";
		return status.canAskAgain ? "undetermined" : "denied";
	} catch {
		return "unavailable";
	}
}

/** Asks for permission when it can still be asked; resolves to where it stands after. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
	const N = notifications();
	if (!N) return "unavailable";
	try {
		const current = await N.getPermissionsAsync();
		if (current.granted) return "granted";
		if (!current.canAskAgain) return "denied";
		const asked = await N.requestPermissionsAsync();
		return asked.granted ? "granted" : asked.canAskAgain ? "undetermined" : "denied";
	} catch {
		return "unavailable";
	}
}

/**
 * Shows reminders while the app is open too, and hands a tapped reminder's
 * debt to `onOpen` — including the one the app was cold-started from.
 * Returns the cleanup.
 */
export function listenForReminderTaps(onOpen: (debtId: string) => void): () => void {
	const N = notifications();
	if (!N) return () => {};

	const open = (response: NotificationsApi.NotificationResponse | null) => {
		const data = response?.notification.request.content.data;
		if (data?.kind === KIND && typeof data.debtId === "string") onOpen(data.debtId);
	};

	try {
		N.setNotificationHandler({
			handleNotification: async () => ({
				shouldShowBanner: true,
				shouldShowList: true,
				shouldPlaySound: false,
				shouldSetBadge: false,
			}),
		});
		open(N.getLastNotificationResponse());
		const subscription = N.addNotificationResponseReceivedListener(open);
		return () => subscription.remove();
	} catch (e) {
		console.warn("[reminders] can't listen for taps in this build", e);
		return () => {};
	}
}
