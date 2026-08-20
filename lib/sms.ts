import type {
	BadgeTone,
} from "@/components/ui";
import type {
	SendStatus,
	SmsSchedule,
	Weekday,
} from "@/modules/sms-scheduler";

/**
 * Presentation helpers for scheduled messages. The native module deals in
 * timestamps and weekday numbers; everything that turns those into something
 * a person reads lives here.
 */

export const WEEKDAYS: { value: Weekday; short: string; long: string }[] = [
	{ value: 1, short: "Sun", long: "Sunday" },
	{ value: 2, short: "Mon", long: "Monday" },
	{ value: 3, short: "Tue", long: "Tuesday" },
	{ value: 4, short: "Wed", long: "Wednesday" },
	{ value: 5, short: "Thu", long: "Thursday" },
	{ value: 6, short: "Fri", long: "Friday" },
	{ value: 7, short: "Sat", long: "Saturday" },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function formatTime(hour: number, minute: number): string {
	return `${pad(hour)}:${pad(minute)}`;
}

export function formatDate(ms: number): string {
	return new Date(ms).toLocaleDateString(undefined, {
		day: "numeric",
		month: "short",
		year: "numeric",
	});
}

export function formatDateTime(ms: number): string {
	const d = new Date(ms);
	return `${formatDate(ms)}, ${formatTime(d.getHours(), d.getMinutes())}`;
}

/** "in 3 h 20 m" / "in 4 days" / "2 h ago" — for a next- or last-run line. */
export function formatRelative(ms: number, now = Date.now()): string {
	const diff = ms - now;
	const abs = Math.abs(diff);
	const minutes = Math.round(abs / 60_000);

	let text: string;
	if (minutes < 1) text = "less than a minute";
	else if (minutes < 60) text = `${minutes} min`;
	else if (minutes < 60 * 24) {
		const h = Math.floor(minutes / 60);
		const m = minutes % 60;
		text = m === 0 ? `${h} h` : `${h} h ${m} min`;
	} else {
		const days = Math.round(minutes / (60 * 24));
		text = days === 1 ? "1 day" : `${days} days`;
	}

	return diff >= 0 ? `in ${text}` : `${text} ago`;
}

/** One line describing when a schedule runs — "Mon, Wed, Fri at 18:30". */
export function describeSchedule(schedule: SmsSchedule): string {
	const time = formatTime(schedule.hour, schedule.minute);

	if (schedule.repeat === "daily") return `Every day at ${time}`;

	if (schedule.repeat === "weekly") {
		const days = WEEKDAYS.filter((d) =>
			schedule.daysOfWeek.includes(d.value),
		).map((d) => d.short);
		if (days.length === 7) return `Every day at ${time}`;
		if (days.length === 0) return `Weekly at ${time}`;
		return `${days.join(", ")} at ${time}`;
	}

	return `Once on ${formatDate(schedule.triggerAt)} at ${time}`;
}

export function describeNextRun(schedule: SmsSchedule): string {
	if (!schedule.enabled) return "Paused";
	if (!schedule.nextTriggerAt) {
		// A one-shot that has already been used, or whose time passed while it
		// was paused — switching it back on can't arm anything.
		return schedule.repeat === "none"
			? "That time has passed — edit it to pick a new one"
			: "Nothing scheduled";
	}
	return `Next ${formatRelative(schedule.nextTriggerAt)} — ${formatDateTime(
		schedule.nextTriggerAt,
	)}`;
}

export const STATUS_LABELS: Record<SendStatus, string> = {
	pending: "Sending",
	sent: "Sent",
	partial: "Partly sent",
	failed: "Failed",
	missed: "Missed",
};

export function statusTone(status: SendStatus): BadgeTone {
	switch (status) {
		case "sent":
			return "success";
		case "failed":
			return "danger";
		case "missed":
		case "partial":
			return "warning";
		default:
			return "neutral";
	}
}

// -- message length ----------------------------------------------------------

/** GSM 03.38 basic alphabet — one septet each. */
const GSM7_BASIC = new Set(
	"@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡" +
		"ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);

/** Escape-prefixed extensions — two septets each. */
const GSM7_EXTENDED = new Set("^{}\\[~]|€");

export type SegmentInfo = {
	encoding: "GSM-7" | "UCS-2";
	/** Billable units used — septets for GSM-7, UTF-16 code units for UCS-2. */
	used: number;
	/** Units available across the current number of segments. */
	capacity: number;
	segments: number;
};

/**
 * Works out how many SMS a body will be split into.
 *
 * Worth surfacing: one Cyrillic or emoji character drops the whole message to
 * UCS-2 and cuts the per-segment budget from 160 characters to 70, which is
 * how a "short" message quietly turns into three billed SMS.
 */
export function segmentInfo(body: string): SegmentInfo {
	let septets = 0;
	let gsm7 = true;

	for (const char of body) {
		if (GSM7_BASIC.has(char)) septets += 1;
		else if (GSM7_EXTENDED.has(char)) septets += 2;
		else {
			gsm7 = false;
			break;
		}
	}

	if (gsm7) {
		const segments = septets <= 160 ? Math.max(1, Math.ceil(septets / 160)) : Math.ceil(septets / 153);
		return {
			encoding: "GSM-7",
			used: septets,
			capacity: segments <= 1 ? 160 : segments * 153,
			segments,
		};
	}

	// UTF-16 code units: a non-BMP emoji is a surrogate pair and costs two.
	const units = body.length;
	const segments = units <= 70 ? Math.max(1, Math.ceil(units / 70)) : Math.ceil(units / 67);
	return {
		encoding: "UCS-2",
		used: units,
		capacity: segments <= 1 ? 70 : segments * 67,
		segments,
	};
}

// -- building a schedule -----------------------------------------------------

/** Local-time epoch ms for a calendar day at a given time of day. */
export function combineDateAndTime(
	date: Date,
	hour: number,
	minute: number,
): number {
	const d = new Date(date);
	d.setHours(hour, minute, 0, 0);
	return d.getTime();
}

/** The next `count` calendar days, starting today, at local midnight. */
export function upcomingDays(count: number, from = new Date()): Date[] {
	const start = new Date(from);
	start.setHours(0, 0, 0, 0);
	return Array.from({ length: count }, (_, i) => {
		const d = new Date(start);
		d.setDate(d.getDate() + i);
		return d;
	});
}

export function dayLabel(date: Date, today = new Date()): string {
	const midnight = new Date(today);
	midnight.setHours(0, 0, 0, 0);
	const days = Math.round((date.getTime() - midnight.getTime()) / 86_400_000);
	if (days === 0) return "Today";
	if (days === 1) return "Tomorrow";
	return date.toLocaleDateString(undefined, {
		weekday: "short",
		day: "numeric",
		month: "short",
	});
}
