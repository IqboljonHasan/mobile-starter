import data from "@/data/loopPrayers.json";

/**
 * The five daily prayers as a Loop Habit Tracker backup recorded them, and the
 * qazo made up since for the ones that were missed.
 *
 * The record itself is fixed — it's what the backup says, written to
 * data/loopPrayers.json by scripts/import-loop-prayers.ts. What the app adds is
 * a mark per missed prayer (hooks/useQazaMarks.ts), kept apart from the record
 * so that importing a newer backup never loses one.
 *
 * Only what Loop was explicitly told counts as missed: an entry marked "no"
 * or "unknown". A prayer with no entry at all is left out — the backup has
 * plenty of those on days that were simply never filled in, and reading them
 * as missed would bury the real list.
 */

/** As recorded in Loop: prayed, marked not prayed, or marked unknown. */
export type RecordedStatus = "prayed" | "missed" | "unknown";

export type PrayerEntry = {
	/** "2026-03-24:4" — stable across re-imports, so a mark stays attached. */
	key: string;
	/** Calendar day, "YYYY-MM-DD". */
	date: string;
	/** 0 = Bomdod … 4 = Xufton, in the order of the day. */
	prayer: number;
	status: RecordedStatus;
};

/** When each made-up prayer was marked, by entry key. */
export type QazaMarks = Record<string, number>;

export type DaySection = { date: string; data: PrayerEntry[] };

/** The names as the backup has them — "Xufton & Vitr" included. */
export const PRAYER_NAMES: string[] = data.prayers;

export const SOURCE: string = data.source;

const days = data.days as Record<string, (number | null)[]>;

function statusOf(code: number): RecordedStatus {
	return code === 1 ? "prayed" : code === 0 ? "missed" : "unknown";
}

/**
 * Every recorded prayer, newest first: the latest day on top, and within a
 * day the latest prayer first.
 */
export const ENTRIES: PrayerEntry[] = Object.keys(days)
	.sort()
	.reverse()
	.flatMap((date) =>
		[4, 3, 2, 1, 0].flatMap((prayer) => {
			const code = days[date][prayer];
			return code === null || code === undefined
				? []
				: [{ key: `${date}:${prayer}`, date, prayer, status: statusOf(code) }];
		}),
	);

/** Recorded as not prayed — whether or not it has been made up since. */
export function wasMissed(entry: PrayerEntry): boolean {
	return entry.status !== "prayed";
}

/** Missed, and not yet marked as made up — what the filter shows. */
export function isOwed(entry: PrayerEntry, marks: QazaMarks): boolean {
	return wasMissed(entry) && marks[entry.key] === undefined;
}

/** Groups entries, already sorted newest first, into one section per day. */
export function byDay(entries: PrayerEntry[]): DaySection[] {
	const sections: DaySection[] = [];
	for (const entry of entries) {
		const last = sections[sections.length - 1];
		if (last?.date === entry.date) last.data.push(entry);
		else sections.push({ date: entry.date, data: [entry] });
	}
	return sections;
}

const MONTHS = [
	"yanvar", "fevral", "mart", "aprel", "may", "iyun",
	"iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
const WEEKDAYS = [
	"yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba",
];

/**
 * "24-mart 2026, seshanba". The year is always there — the record spans
 * several. Built from local parts, so the weekday can't slide a day.
 */
export function formatDay(iso: string): string {
	const [y, m, d] = iso.split("-").map(Number);
	const weekday = WEEKDAYS[new Date(y, m - 1, d).getDay()];
	return `${d}-${MONTHS[m - 1]} ${y}, ${weekday}`;
}
