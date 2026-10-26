import * as SQLite from "expo-sqlite";
import { BACKUP_FORMAT, BACKUP_VERSION, type BackupPayload } from "@/lib/backup";

/**
 * The ledger as an SQLite database — the one form a backup takes, whether it
 * is shared from Settings or sent to Telegram.
 *
 * One table per list in the backup and one column per field, so the file opens
 * in any SQLite browser and reads like the ledger it came from. The nested
 * lists — a category's subcategories, an income's allocations, a debt's
 * payments — stay JSON inside their parent's row: they mean nothing apart from
 * it, and keeping them there lets a restore hand the rows straight to
 * `parseBackupData` in the shape it validates.
 *
 * The database is built in memory and serialized to bytes, never opened on
 * disk: the app's own data stays in AsyncStorage, and nothing here outlives
 * the call.
 */

type Kind = "text" | "real" | "integer" | "bool" | "json";

type Table = {
	name: Exclude<keyof BackupPayload, "defaultUnit">;
	/** Field names as they are on the record; each column is its snake_case. */
	columns: [field: string, kind: Kind][];
};

const TABLES: Table[] = [
	{
		name: "categories",
		columns: [
			["id", "text"],
			["type", "text"],
			["name", "text"],
			["color", "text"],
			["icon", "text"],
			["subcategories", "json"],
			["walletIds", "json"],
			["splitIncome", "bool"],
		],
	},
	{
		name: "wallets",
		columns: [
			["id", "text"],
			["name", "text"],
			["color", "text"],
			["icon", "text"],
			["percent", "real"],
		],
	},
	{
		name: "transactions",
		columns: [
			["id", "text"],
			["type", "text"],
			["amount", "real"],
			["unit", "text"],
			["method", "text"],
			["categoryId", "text"],
			["subcategoryId", "text"],
			["description", "text"],
			["date", "text"],
			["createdAt", "integer"],
			["allocations", "json"],
			["walletId", "text"],
			["debtId", "text"],
			["memberId", "text"],
		],
	},
	{
		name: "transfers",
		columns: [
			["id", "text"],
			["fromWalletId", "text"],
			["toWalletId", "text"],
			["amount", "real"],
			["unit", "text"],
			["date", "text"],
			["note", "text"],
			["createdAt", "integer"],
		],
	},
	{
		name: "contacts",
		columns: [
			["id", "text"],
			["name", "text"],
			["phone", "text"],
			["note", "text"],
			["sourceId", "text"],
			["tag", "text"],
			["createdAt", "integer"],
		],
	},
	{
		name: "debts",
		columns: [
			["id", "text"],
			["direction", "text"],
			["contactId", "text"],
			["amount", "real"],
			["unit", "text"],
			["method", "text"],
			["walletId", "text"],
			["description", "text"],
			["date", "text"],
			["dueDate", "text"],
			["remind", "bool"],
			["transactionId", "text"],
			["payments", "json"],
			["createdAt", "integer"],
		],
	},
	{
		name: "templates",
		columns: [
			["id", "text"],
			["name", "text"],
			["type", "text"],
			["amount", "real"],
			["unit", "text"],
			["method", "text"],
			["categoryId", "text"],
			["subcategoryId", "text"],
			["description", "text"],
			["walletId", "text"],
			["split", "bool"],
			["memberId", "text"],
			["createdAt", "integer"],
		],
	},
	{
		name: "members",
		columns: [
			["id", "text"],
			["name", "text"],
			["color", "text"],
			["createdAt", "integer"],
		],
	},
];

const SQL_TYPE: Record<Kind, string> = {
	text: "TEXT",
	real: "REAL",
	integer: "INTEGER",
	bool: "INTEGER",
	json: "TEXT",
};

function columnName(field: string): string {
	return field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function toSql(value: unknown, kind: Kind): SQLite.SQLiteBindValue {
	switch (kind) {
		case "text":
			return typeof value === "string" ? value : null;
		case "real":
		case "integer":
			return typeof value === "number" && Number.isFinite(value) ? value : null;
		case "bool":
			return typeof value === "boolean" ? (value ? 1 : 0) : null;
		case "json":
			return value === undefined ? null : JSON.stringify(value);
	}
}

function fromSql(value: unknown, kind: Kind): unknown {
	if (value === null || value === undefined) return null;
	switch (kind) {
		case "bool":
			return value === 1 ? true : value === 0 ? false : null;
		case "json":
			if (typeof value !== "string") return null;
			try {
				return JSON.parse(value);
			} catch {
				return null;
			}
		default:
			return value;
	}
}

/** Builds the .db file's bytes. */
export function serializeBackupDb(
	payload: BackupPayload,
	now: Date = new Date(),
): Uint8Array {
	const db = SQLite.openDatabaseSync(":memory:");
	try {
		// `position` keeps each list in the order it had — the order categories
		// and wallets are shown in is the array's own, with no field of its own.
		db.execSync(
			[
				"CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);",
				...TABLES.map(
					(t) =>
						`CREATE TABLE ${t.name} (position INTEGER PRIMARY KEY, ${t.columns
							.map(([field, kind]) => `${columnName(field)} ${SQL_TYPE[kind]}`)
							.join(", ")});`,
				),
				`PRAGMA user_version = ${BACKUP_VERSION};`,
			].join("\n"),
		);

		db.withTransactionSync(() => {
			const meta: Record<string, string> = {
				format: BACKUP_FORMAT,
				version: String(BACKUP_VERSION),
				exportedAt: now.toISOString(),
				defaultUnit: payload.defaultUnit,
			};
			for (const [key, value] of Object.entries(meta)) {
				db.runSync("INSERT INTO meta (key, value) VALUES (?, ?)", key, value);
			}

			for (const table of TABLES) {
				const columns = table.columns.map(([field]) => columnName(field));
				const statement = db.prepareSync(
					`INSERT INTO ${table.name} (position, ${columns.join(", ")}) VALUES (${[
						"?",
						...columns.map(() => "?"),
					].join(", ")})`,
				);
				try {
					payload[table.name].forEach((record, position) => {
						const row = record as Record<string, unknown>;
						statement.executeSync([
							position,
							...table.columns.map(([field, kind]) => toSql(row[field], kind)),
						]);
					});
				} finally {
					statement.finalizeSync();
				}
			}
		});

		return db.serializeSync();
	} finally {
		db.closeSync();
	}
}

/**
 * Decodes a .db backup into plain records, for `parseBackupData` to judge. Nothing is validated here: a table or column the
 * file lacks simply comes back absent. Throws when the bytes aren't a readable
 * database at all.
 */
export function readBackupDb(bytes: Uint8Array): Record<string, unknown> {
	const db = SQLite.deserializeDatabaseSync(bytes);
	try {
		const tables = new Set(
			db
				.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table'")
				.map((r) => r.name),
		);
		const raw: Record<string, unknown> = {};

		if (tables.has("meta")) {
			for (const { key, value } of db.getAllSync<{ key: unknown; value: unknown }>(
				"SELECT key, value FROM meta",
			)) {
				if (typeof key === "string") raw[key] = value;
			}
			// Everything in `meta` is text; the version is the one number. A
			// missing or garbled one must stay absent rather than become NaN,
			// which would slip past the "newer than this app" check.
			const version = Number(raw.version);
			raw.version = Number.isFinite(version) ? version : undefined;
		}

		for (const table of TABLES) {
			if (!tables.has(table.name)) continue;
			raw[table.name] = db
				.getAllSync<Record<string, unknown>>(`SELECT * FROM ${table.name} ORDER BY rowid`)
				.map((row) =>
					Object.fromEntries(
						table.columns.map(([field, kind]) => [
							field,
							fromSql(row[columnName(field)], kind),
						]),
					),
				);
		}
		return raw;
	} finally {
		db.closeSync();
	}
}
