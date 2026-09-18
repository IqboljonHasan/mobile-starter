/**
 * Dates are handled as local calendar days ("YYYY-MM-DD"), never timestamps.
 *
 * A transaction belongs to the day the user picked, so it must not shift when
 * the device crosses a timezone or DST boundary. Everything here builds Dates
 * with the local-parts constructor (`new Date(y, m, d)`) rather than parsing an
 * ISO string, which JS reads as UTC and would slide by a day west of Greenwich.
 */

const MONTHS_LONG = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_LONG.map((m) => m.slice(0, 3));
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Monday-first column headers for the calendar grid. */
export const WEEKDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"];

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

export function monthLabel(monthKey: string, long = false): string {
	const [y, m] = monthKey.split("-").map(Number);
	const names = long ? MONTHS_LONG : MONTHS_SHORT;
	const name = names[m - 1] ?? "";
	// The year is only worth the space when it isn't the current one.
	return y === new Date().getFullYear() ? name : `${name} ${y}`;
}

/** "September 2026" — always spelled out with the year, for a calendar header. */
export function monthTitle(monthKey: string): string {
	const [y, m] = monthKey.split("-").map(Number);
	return `${MONTHS_LONG[m - 1] ?? ""} ${y}`;
}

/** "18 Sep 2026" — the year is dropped inside the current year. */
export function formatDate(iso: string): string {
	const date = fromISODate(iso);
	const base = `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
	return date.getFullYear() === new Date().getFullYear()
		? base
		: `${base} ${date.getFullYear()}`;
}

/** "Today", "Yesterday", or "Fri, 18 Sep" — for a date field and list headers. */
export function formatDayLabel(iso: string): string {
	const today = todayISO();
	if (iso === today) return "Today";
	if (iso === addDaysISO(today, -1)) return "Yesterday";
	if (iso === addDaysISO(today, 1)) return "Tomorrow";
	const date = fromISODate(iso);
	return `${WEEKDAYS_SHORT[date.getDay()]}, ${formatDate(iso)}`;
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
