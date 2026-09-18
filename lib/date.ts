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

/** "18-sen" — the year is only added outside the current year. */
export function formatDate(iso: string): string {
	const date = fromISODate(iso);
	const base = `${date.getDate()}-${MONTHS_SHORT[date.getMonth()]}`;
	return date.getFullYear() === new Date().getFullYear()
		? base
		: `${base} ${date.getFullYear()}`;
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
