/**
 * Dates are handled as local calendar days ("YYYY-MM-DD"), never timestamps.
 *
 * A transaction belongs to the day the user picked, so it must not shift when
 * the device crosses a timezone or DST boundary. Everything here builds Dates
 * with the local-parts constructor (`new Date(y, m, d)`) rather than parsing an
 * ISO string, which JS reads as UTC and would slide by a day west of Greenwich.
 */

const MONTHS_LONG = [
	"Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
	"Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];
// Written out rather than sliced from the long names: "iyun" and "iyul" are the
// same three letters, and the short form is what dates are printed with.
const MONTHS_SHORT = [
	"yan", "fev", "mar", "apr", "may", "iyn",
	"iyl", "avg", "sen", "okt", "noy", "dek",
];
const WEEKDAYS_SHORT = ["Yak", "Dush", "Sesh", "Chor", "Pay", "Jum", "Shan"];
const WEEKDAYS_LONG = [
	"yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba",
];

/** Monday-first column headers for the calendar grid. */
export const WEEKDAY_INITIALS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

export function toISODate(date: Date): string {
	const y = date.getFullYear();
	const m = `${date.getMonth() + 1}`.padStart(2, "0");
	const d = `${date.getDate()}`.padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function todayISO(): string {
	return toISODate(new Date());
}

export function addDaysISO(iso: string, days: number): string {
	const date = fromISODate(iso);
	date.setDate(date.getDate() + days);
	return toISODate(date);
}

/** "2026-09-18" → "2026-09" */
export function monthKeyOf(iso: string): string {
	return iso.slice(0, 7);
}

export function currentMonthKey(): string {
	return monthKeyOf(todayISO());
}

export function shiftMonth(monthKey: string, delta: number): string {
	const [y, m] = monthKey.split("-").map(Number);
	const date = new Date(y, m - 1 + delta, 1);
	return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}`;
}

/** "Sentabr 2026" — always spelled out with the year, for a calendar header. */
export function monthTitle(monthKey: string): string {
	const [y, m] = monthKey.split("-").map(Number);
	return `${MONTHS_LONG[m - 1] ?? ""} ${y}`;
}

/** "2026-09" → "Sentabr" — for a label where the year is already on screen. */
export function monthName(monthKey: string): string {
	const [, m] = monthKey.split("-").map(Number);
	return MONTHS_LONG[(m ?? 1) - 1] ?? "";
}

/** "2026-09" → "sen" — a trend chart's bar label, too narrow for the full name. */
export function monthShortLabel(monthKey: string): string {
	const [, m] = monthKey.split("-").map(Number);
	return MONTHS_SHORT[(m ?? 1) - 1] ?? "";
}

/** 28 to 31 — day 0 of the next month is the last day of this one. */
export function daysInMonth(monthKey: string): number {
	const [y, m] = monthKey.split("-").map(Number);
	return new Date(y, m, 0).getDate();
}

/** The twelve month keys of `yearKey`, January first. */
export function monthsOfYear(yearKey: string): string[] {
	return Array.from({ length: 12 }, (_, i) => `${yearKey}-${`${i + 1}`.padStart(2, "0")}`);
}

/** Calendar days from `from` to `to`, both included. */
export function daysBetween(from: string, to: string): number {
	const ms = fromISODate(to).getTime() - fromISODate(from).getTime();
	// Rounded rather than floored: across a DST change one day is 23 or 25
	// hours long.
	return Math.round(ms / 86_400_000) + 1;
}

/** `count` month keys ending at (and including) `endMonthKey`, oldest first —
 *  what a trailing trend chart plots along its x-axis. */
export function lastMonthKeys(
	count: number,
	endMonthKey: string = currentMonthKey(),
): string[] {
	const keys: string[] = [];
	for (let i = count - 1; i >= 0; i--) keys.push(shiftMonth(endMonthKey, -i));
	return keys;
}

/** "2026-09-18" → "2026" */
export function yearKeyOf(iso: string): string {
	return iso.slice(0, 4);
}

export function currentYearKey(): string {
	return yearKeyOf(todayISO());
}

/** "18-sen" — the year is only added outside the current year. */
export function formatDate(iso: string): string {
	const date = fromISODate(iso);
	const base = `${date.getDate()}-${MONTHS_SHORT[date.getMonth()]}`;
	return date.getFullYear() === new Date().getFullYear()
		? base
		: `${base} ${date.getFullYear()}`;
}

/** "3-oktabr, shanba" — a day spelled out in full, for a screen header. */
export function formatLongDate(iso: string): string {
	const date = fromISODate(iso);
	const month = MONTHS_LONG[date.getMonth()].toLowerCase();
	return `${date.getDate()}-${month}, ${WEEKDAYS_LONG[date.getDay()]}`;
}

/** "Bugun", "Kecha", or "Jum, 18-sen" — for a date field and list headers. */
export function formatDayLabel(iso: string): string {
	const today = todayISO();
	if (iso === today) return "Bugun";
	if (iso === addDaysISO(today, -1)) return "Kecha";
	if (iso === addDaysISO(today, 1)) return "Ertaga";
	const date = fromISODate(iso);
	return `${WEEKDAYS_SHORT[date.getDay()]}, ${formatDate(iso)}`;
}

/**
 * The same day `months` later — pulled back to the month's last day when it
 * has fewer, so 31 January plus a month is 28/29 February, not 3 March.
 */
export function addMonthsISO(iso: string, months: number): string {
	const date = fromISODate(iso);
	const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
	const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
	target.setDate(Math.min(date.getDate(), last));
	return toISODate(target);
}

/** "21-oktabr", with the year only outside the current one — "21-oktabr, 2025". */
export function formatDayMonth(iso: string): string {
	const date = fromISODate(iso);
	const base = `${date.getDate()}-${MONTHS_LONG[date.getMonth()].toLowerCase()}`;
	return date.getFullYear() === new Date().getFullYear()
		? base
		: `${base}, ${date.getFullYear()}`;
}

/** The word for a day next to today, or null — "Bugun", "Kecha", "Ertaga". */
function relativeDay(iso: string): string | null {
	const today = todayISO();
	if (iso === today) return "Bugun";
	if (iso === addDaysISO(today, -1)) return "Kecha";
	if (iso === addDaysISO(today, 1)) return "Ertaga";
	return null;
}

/** "Bugun, 21-oktabr" or "18-oktabr, yakshanba" — a picked day shown in a field. */
export function formatFieldDate(iso: string): string {
	const relative = relativeDay(iso);
	if (relative) return `${relative}, ${formatDayMonth(iso)}`;
	return `${formatDayMonth(iso)}, ${WEEKDAYS_LONG[fromISODate(iso).getDay()]}`;
}

/** "Bugun · 21-oktabr, chorshanba" — the heading over one day of a list. */
export function formatSectionDay(iso: string): string {
	const relative = relativeDay(iso);
	const day = `${formatDayMonth(iso)}, ${WEEKDAYS_LONG[fromISODate(iso).getDay()]}`;
	return relative ? `${relative} · ${day}` : day;
}

export type CalendarCell = {
	iso: string;
	day: number;
	inMonth: boolean;
};

/**
 * Six rows of seven days covering `monthKey`, padded with the neighbouring
 * months' days. A fixed row count keeps the sheet from resizing as the user
 * pages through months.
 */
export function buildMonthGrid(monthKey: string): CalendarCell[][] {
	const [y, m] = monthKey.split("-").map(Number);
	const first = new Date(y, m - 1, 1);
	// getDay() is Sunday-first; shift so Monday starts the week.
	const leading = (first.getDay() + 6) % 7;
	const start = new Date(y, m - 1, 1 - leading);

	const weeks: CalendarCell[][] = [];
	const cursor = start;
	for (let w = 0; w < 6; w++) {
		const week: CalendarCell[] = [];
		for (let d = 0; d < 7; d++) {
			week.push({
				iso: toISODate(cursor),
				day: cursor.getDate(),
				inMonth: cursor.getMonth() === m - 1,
			});
			cursor.setDate(cursor.getDate() + 1);
		}
		weeks.push(week);
	}
	return weeks;
}
