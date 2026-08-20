export type RepeatMode = "none" | "daily" | "weekly";

/**
 * Outcome of a schedule's most recent run.
 *
 * `partial` means some segments of a multi-part message went out and others
 * did not; `missed` means the trigger passed while the device was off for
 * longer than the catch-up window.
 */
export type SendStatus = "pending" | "sent" | "partial" | "failed" | "missed";

/** 1 = Sunday … 7 = Saturday — `Date#getDay() + 1`. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface SmsSchedule {
	id: string;
	recipients: string[];
	body: string;
	repeat: RepeatMode;
	/** Local time of day for repeating schedules. */
	hour: number;
	minute: number;
	/** Only meaningful when `repeat` is `"weekly"`. */
	daysOfWeek: Weekday[];
	/** Epoch ms. Only meaningful when `repeat` is `"none"`. */
	triggerAt: number;
	/** Telephony subscription id, or -1 for the default SMS SIM. */
	subscriptionId: number;
	enabled: boolean;
	createdAt: number;
	lastStatus: SendStatus | null;
	lastError: string | null;
	/** Epoch ms, or 0 when it has never run. */
	lastRunAt: number;
	/** Epoch ms of the next fire, or null when nothing is armed. */
	nextTriggerAt: number | null;
}

export interface ScheduleInput {
	/** Omit to create; pass an existing id to replace that schedule. */
	id?: string;
	recipients: string[];
	body: string;
	repeat: RepeatMode;
	hour: number;
	minute: number;
	daysOfWeek?: Weekday[];
	/** Required for `repeat: "none"`. Must be in the future. */
	triggerAt?: number;
	subscriptionId?: number;
	enabled?: boolean;
}

export interface SimSlot {
	subscriptionId: number;
	slotIndex: number;
	displayName: string | null;
	carrierName: string | null;
	number: string | null;
}

export interface SendLogEntry {
	id: string;
	/** null for messages sent through `sendNow`. */
	scheduleId: string | null;
	recipient: string;
	body: string;
	createdAt: number;
	status: SendStatus;
	/** Segments the message was split into. */
	parts: number;
	sentParts: number;
	error: string | null;
}

export interface PermissionResult {
	status: "granted" | "denied" | "undetermined";
	granted: boolean;
	canAskAgain: boolean;
	expires: "never" | number;
}
