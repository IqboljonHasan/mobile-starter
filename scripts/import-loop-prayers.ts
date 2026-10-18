/**
 * Pulls the five daily prayers out of a Loop Habit Tracker backup into
 * data/loopPrayers.json, which the Namoz tab reads.
 *
 *   bun run import:prayers "Loop Habits Backup 2026-10-15 061920.db"
 *
 * Re-run it with a newer backup to refresh the list. Qazo marks made in the app
 * survive that: they're stored by date and prayer, not by anything in the file.
 */
import { Database } from "bun:sqlite";
import { mkdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

/** In the order of the day. Matched by name, since ids differ between backups. */
const PRAYERS = [/^bomdod/i, /^peshin/i, /^asr/i, /^shom/i, /^xufton/i];

/**
 * Loop's entry values, folded into what the app distinguishes: 1 prayed,
 * 0 not prayed, -1 marked unknown. A skip (3) says the day didn't count, so it
 * is left out like a day with no entry at all.
 */
function code(value: number): number | null {
	if (value === 2 || value === 1) return 1;
	if (value === 0) return 0;
	if (value === -1) return -1;
	return null;
}

const source = process.argv[2];
if (!source) {
	console.error('Usage: bun run import:prayers "<Loop Habits Backup>.db"');
	process.exit(1);
}

const db = new Database(source, { readonly: true });
const habits = db.query("SELECT id, name FROM Habits").all() as { id: number; name: string }[];
const found = PRAYERS.map((pattern) => {
	const habit = habits.find((h) => pattern.test(h.name.trim()));
	if (!habit) {
		console.error(`No habit matching ${pattern} in ${source}`);
		process.exit(1);
	}
	return habit;
});

const days: Record<string, (number | null)[]> = {};
const rows = db
	.query(
		`SELECT habit, timestamp, value FROM Repetitions WHERE habit IN (${found.map((h) => h.id).join(",")})`,
	)
	.all() as { habit: number; timestamp: number; value: number }[];
for (const row of rows) {
	const value = code(row.value);
	if (value === null) continue;
	// Loop stores each day as midnight UTC of the calendar day it means.
	const date = new Date(row.timestamp).toISOString().slice(0, 10);
	days[date] ??= [null, null, null, null, null];
	days[date][found.findIndex((h) => h.id === row.habit)] = value;
}
db.close();

// One day per line, so a re-import reads as a diff of the days that changed.
const lines = Object.keys(days)
	.sort()
	.map((date) => `    ${JSON.stringify(date)}: ${JSON.stringify(days[date])}`);
const json =
	"{\n" +
	`  "source": ${JSON.stringify(basename(source))},\n` +
	`  "prayers": ${JSON.stringify(found.map((h) => h.name.trim()))},\n` +
	`  "days": {\n${lines.join(",\n")}\n  }\n` +
	"}\n";

const out = join(import.meta.dir, "..", "data", "loopPrayers.json");
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, json);
console.log(`${Object.keys(days).length} days, ${rows.length} entries → ${out}`);
