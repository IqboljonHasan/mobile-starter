import { requireOptionalNativeModule } from "expo";

import type {
	PermissionResult,
	ScheduleInput,
	SendLogEntry,
	SimSlot,
	SmsSchedule,
} from "./SmsScheduler.types";

export * from "./SmsScheduler.types";

/**
 * Structural stand-in for expo-modules-core's `EventSubscription` — `expo`
 * itself doesn't re-export the type, and reaching into a transitive dependency
 * for one interface isn't worth it.
 */
export type EventSubscription = { remove(): void };

type NativeSmsScheduler = {
	isSupported(): boolean;
	canScheduleExactAlarms(): boolean;
	isIgnoringBatteryOptimizations(): boolean;
	getPermissionsAsync(): Promise<PermissionResult>;
	requestPermissionsAsync(): Promise<PermissionResult>;
	requestPhoneStatePermissionAsync(): Promise<PermissionResult>;
	openExactAlarmSettingsAsync(): Promise<boolean>;
	openBatteryOptimizationSettingsAsync(): Promise<boolean>;
	openAppSettingsAsync(): Promise<boolean>;
	getSimSlotsAsync(): Promise<SimSlot[]>;
	listSchedulesAsync(): Promise<SmsSchedule[]>;
	saveScheduleAsync(input: Required<ScheduleInput>): Promise<SmsSchedule>;
	setScheduleEnabledAsync(id: string, enabled: boolean): Promise<SmsSchedule>;
	cancelScheduleAsync(id: string): Promise<void>;
	rescheduleAllAsync(): Promise<void>;
	sendNowAsync(
		recipients: string[],
		body: string,
		subscriptionId: number,
	): Promise<string[]>;
	getLogAsync(limit: number): Promise<SendLogEntry[]>;
	clearLogAsync(): Promise<void>;
	addListener(
		event: "onSchedulesChanged",
		listener: () => void,
	): EventSubscription;
};

/**
 * Android only, and only in a native build — sending without user interaction
 * needs `SmsManager`, which has no iOS counterpart and is not in Expo Go.
 * `null` everywhere else, so callers degrade instead of crashing.
 */
const native = requireOptionalNativeModule<NativeSmsScheduler>("SmsScheduler");

let supported: boolean | null = null;

/**
 * True when scheduled sending can actually run on this device and build.
 *
 * Cached on first call: neither the module's presence nor the telephony feature
 * can change while the app is running, and this is read on every render of the
 * screens that use it.
 */
export function isAvailable(): boolean {
	if (supported === null) {
		supported = native != null && native.isSupported();
	}
	return supported;
}

function requireNative(): NativeSmsScheduler {
	if (!native) {
		throw new Error(
			"SmsScheduler is unavailable. It requires a native Android build — " +
				"run `bun run android` rather than Expo Go.",
		);
	}
	return native;
}

// -- permissions & capabilities ---------------------------------------------

export async function getPermissions(): Promise<PermissionResult> {
	if (!native) return DENIED;
	return native.getPermissionsAsync();
}

export async function requestPermissions(): Promise<PermissionResult> {
	return requireNative().requestPermissionsAsync();
}

/** Needed only to list SIM slots; sending works without it on the default SIM. */
export async function requestPhoneStatePermission(): Promise<PermissionResult> {
	return requireNative().requestPhoneStatePermissionAsync();
}

/**
 * False on Android 14+ until the user grants "Alarms & reminders". Schedules
 * still fire when this is false, but the OS is free to batch them, so a 09:00
 * message may land at 09:12.
 */
export function canScheduleExactAlarms(): boolean {
	return native?.canScheduleExactAlarms() ?? false;
}

/**
 * Battery optimisation is the usual reason a schedule fires on one phone and
 * not on another — aggressive OEM skins (Xiaomi, Huawei, Samsung) kill alarms
 * for apps that are not exempt.
 */
export function isIgnoringBatteryOptimizations(): boolean {
	return native?.isIgnoringBatteryOptimizations() ?? false;
}

export async function openExactAlarmSettings(): Promise<boolean> {
	return requireNative().openExactAlarmSettingsAsync();
}

export async function openBatteryOptimizationSettings(): Promise<boolean> {
	return requireNative().openBatteryOptimizationSettingsAsync();
}

export async function openAppSettings(): Promise<boolean> {
	return requireNative().openAppSettingsAsync();
}

export async function getSimSlots(): Promise<SimSlot[]> {
	if (!native) return [];
	return native.getSimSlotsAsync();
}

// -- schedules ---------------------------------------------------------------

export async function listSchedules(): Promise<SmsSchedule[]> {
	if (!native) return [];
	return native.listSchedulesAsync();
}

export async function saveSchedule(input: ScheduleInput): Promise<SmsSchedule> {
	// The native Record has no notion of "missing", so fill the optionals here
	// rather than letting them arrive as undefined.
	return requireNative().saveScheduleAsync({
		id: input.id ?? null,
		recipients: input.recipients,
		body: input.body,
		repeat: input.repeat,
		hour: input.hour,
		minute: input.minute,
		daysOfWeek: input.daysOfWeek ?? [],
		triggerAt: input.triggerAt ?? 0,
		subscriptionId: input.subscriptionId ?? -1,
		enabled: input.enabled ?? true,
	} as unknown as Required<ScheduleInput>);
}

export async function setScheduleEnabled(
	id: string,
	enabled: boolean,
): Promise<SmsSchedule> {
	return requireNative().setScheduleEnabledAsync(id, enabled);
}

export async function cancelSchedule(id: string): Promise<void> {
	return requireNative().cancelScheduleAsync(id);
}

/** Re-arms every alarm. The boot receiver does this too; exposed for recovery. */
export async function rescheduleAll(): Promise<void> {
	return requireNative().rescheduleAllAsync();
}

// -- immediate send ----------------------------------------------------------

/**
 * Sends straight away, bypassing the scheduler. Resolves once the messages are
 * handed to the radio — check the log for whether they were accepted.
 */
export async function sendNow(
	recipients: string[],
	body: string,
	subscriptionId = -1,
): Promise<string[]> {
	return requireNative().sendNowAsync(recipients, body, subscriptionId);
}

// -- log ---------------------------------------------------------------------

export async function getLog(limit = 50): Promise<SendLogEntry[]> {
	if (!native) return [];
	return native.getLogAsync(limit);
}

export async function clearLog(): Promise<void> {
	return requireNative().clearLogAsync();
}

/** Fires when a schedule is sent, edited, or re-armed — including from the alarm. */
export function addSchedulesChangedListener(
	listener: () => void,
): EventSubscription | null {
	if (!native) return null;
	return native.addListener("onSchedulesChanged", listener);
}

const DENIED: PermissionResult = {
	status: "denied",
	granted: false,
	canAskAgain: false,
	expires: "never",
};
