import { File, Paths, UploadType } from "expo-file-system";
import { type BackupPayload, backupFileName } from "@/lib/backup";
import { serializeBackupDb } from "@/lib/backupDb";
import { formatDayLabel, toISODate } from "@/lib/date";
import { getSetting, removeSetting, setSetting } from "@/lib/storage";

/**
 * Sending the ledger to a Telegram chat as a .db file — by hand from Settings,
 * and once a day on its own (lib/backupTask.ts, TelegramBackupContext).
 *
 * The user brings their own bot: a token from @BotFather and the chat it should
 * write to. That keeps the app without a server of its own and the backups in a
 * chat only the user reads. It is the one place the app touches the network,
 * and the only host it talks to is api.telegram.org.
 */

const KEY_TOKEN = "telegram_token";
const KEY_CHAT_ID = "telegram_chat_id";
const KEY_AUTO = "telegram_auto";
const KEY_LAST_SENT = "telegram_last_sent_at";
const KEY_LAST_ATTEMPT = "telegram_last_attempt_at";
const KEY_LAST_ERROR = "telegram_last_error";

const API = "https://api.telegram.org";

/**
 * The least time between one attempt and the next automatic one. Mostly for
 * failures — a wrong token or no network would otherwise be retried on every
 * wake-up and every return to the app — but it also keeps a backup sent just
 * before midnight from being followed by another a minute after.
 */
const RETRY_AFTER_MS = 30 * 60 * 1000;

export type TelegramConfig = {
	token: string;
	chatId: string;
	/** Send once a day on its own. Manual sends work either way. */
	auto: boolean;
};

export type TelegramStatus = {
	lastSentAt: number | null;
	lastAttemptAt: number | null;
	/** Why the most recent attempt failed; cleared by the next success. */
	lastError: string | null;
};

export type SendResult = { ok: true; sentAt: number } | { ok: false; error: string };

export const EMPTY_TELEGRAM_CONFIG: TelegramConfig = { token: "", chatId: "", auto: true };
export const EMPTY_TELEGRAM_STATUS: TelegramStatus = {
	lastSentAt: null,
	lastAttemptAt: null,
	lastError: null,
};

/* Settings ------------------------------------------------------------------ */

/** "123456789:AAH…" — the bot's numeric id, a colon, then the secret. */
const TOKEN_PATTERN = /^\d+:[\w-]{20,}$/;
/** A numeric id (negative for groups and channels) or a public @channel. */
const CHAT_ID_PATTERN = /^(-?\d+|@[A-Za-z]\w{3,})$/;

/** Field errors for the settings form; empty when both fields are usable. */
export function validateTelegramConfig(
	token: string,
	chatId: string,
): { token?: string; chatId?: string } {
	const errors: { token?: string; chatId?: string } = {};
	if (!TOKEN_PATTERN.test(token)) {
		errors.token = "Token 123456789:AAH... ko'rinishida bo'ladi — @BotFather beradi.";
	}
	if (!CHAT_ID_PATTERN.test(chatId)) {
		errors.chatId = "Chat ID raqam (guruh uchun -100... bilan) yoki @kanal nomi bo'ladi.";
	}
	return errors;
}

export function isTelegramConfigured(config: TelegramConfig): boolean {
	return config.token.length > 0 && config.chatId.length > 0;
}

export async function loadTelegramConfig(): Promise<TelegramConfig> {
	const [token, chatId, auto] = await Promise.all([
		getSetting(KEY_TOKEN, ""),
		getSetting(KEY_CHAT_ID, ""),
		getSetting(KEY_AUTO, "1"),
	]);
	return { token, chatId, auto: auto === "1" };
}

export async function saveTelegramConfig(config: TelegramConfig): Promise<void> {
	await Promise.all([
		config.token ? setSetting(KEY_TOKEN, config.token) : removeSetting(KEY_TOKEN),
		config.chatId ? setSetting(KEY_CHAT_ID, config.chatId) : removeSetting(KEY_CHAT_ID),
		setSetting(KEY_AUTO, config.auto ? "1" : "0"),
	]);
}

function asTimestamp(value: string): number | null {
	const n = Number(value);
	return value && Number.isFinite(n) ? n : null;
}

export async function loadTelegramStatus(): Promise<TelegramStatus> {
	const [sent, attempt, error] = await Promise.all([
		getSetting(KEY_LAST_SENT, ""),
		getSetting(KEY_LAST_ATTEMPT, ""),
		getSetting(KEY_LAST_ERROR, ""),
	]);
	return {
		lastSentAt: asTimestamp(sent),
		lastAttemptAt: asTimestamp(attempt),
		lastError: error || null,
	};
}

/** "Bugun, 14:05" — for the status lines in Settings. */
export function formatSentAt(timestamp: number): string {
	const date = new Date(timestamp);
	const pad = (n: number) => `${n}`.padStart(2, "0");
	return `${formatDayLabel(toISODate(date))}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** One line on how the backup stands, for the rows that lead to it. */
export function describeTelegramStatus(
	config: TelegramConfig,
	status: TelegramStatus,
): string {
	if (!isTelegramConfigured(config)) return "Ulanmagan";
	if (status.lastError) return `Xato: ${status.lastError}`;
	if (status.lastSentAt !== null) return `Oxirgi zaxira: ${formatSentAt(status.lastSentAt)}`;
	return "Hali yuborilmagan";
}

/* Scheduling ---------------------------------------------------------------- */

/**
 * Whether today's automatic backup is still owed. "Daily" means once per local
 * calendar day rather than every 24 hours, so a backup that ran late yesterday
 * doesn't push today's past midnight.
 */
export function isBackupDue(
	config: TelegramConfig,
	status: TelegramStatus,
	now: Date = new Date(),
): boolean {
	if (!config.auto || !isTelegramConfigured(config)) return false;
	if (status.lastSentAt !== null && toISODate(new Date(status.lastSentAt)) === toISODate(now)) {
		return false;
	}
	return status.lastAttemptAt === null || now.getTime() - status.lastAttemptAt >= RETRY_AFTER_MS;
}

/* Sending ------------------------------------------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Telegram's own error text is English and terse; these say what to fix. */
function explainError(status: number, description: string): string {
	const text = description.toLowerCase();
	if (status === 401 || status === 404) {
		return "Bot tokeni noto'g'ri. @BotFather bergan tokenni qayta tekshiring.";
	}
	if (text.includes("chat not found")) {
		return "Chat topilmadi. Chat ID to'g'riligini tekshiring va botga /start yuboring.";
	}
	if (status === 403) {
		return "Bot bu chatga yoza olmaydi. Botga /start yuboring yoki uni guruhga qo'shing.";
	}
	if (status === 413 || text.includes("too large")) {
		return "Zaxira fayli Telegram uchun juda katta.";
	}
	if (status === 429) {
		return "Telegram so'rovlarni vaqtincha chekladi. Birozdan keyin qayta urinib ko'ring.";
	}
	return description
		? `Telegram xatosi: ${description}`
		: `Telegram kutilmagan javob qaytardi (${status}).`;
}

function caption(payload: BackupPayload, now: Date): string {
	return (
		`Taqsim zaxira nusxasi · ${formatSentAt(now.getTime())}\n` +
		`${payload.transactions.length} ta yozuv, ${payload.categories.length} ta kategoriya, ` +
		`${payload.debts.length} ta qarz`
	);
}

async function upload(
	config: TelegramConfig,
	payload: BackupPayload,
	now: Date,
): Promise<SendResult> {
	// Telegram names the document after the uploaded file, so the stamp in
	// the name is what tells a week of backups apart in the chat.
	const file = new File(Paths.cache, backupFileName(now));
	try {
		try {
			file.create({ overwrite: true });
			file.write(serializeBackupDb(payload, now));
		} catch (e) {
			console.warn("[telegram] failed to build the backup", e);
			return { ok: false, error: "Zaxira faylini yaratib bo'lmadi." };
		}

		let response: { status: number; body: string };
		try {
			response = await file.upload(`${API}/bot${config.token}/sendDocument`, {
				uploadType: UploadType.MULTIPART,
				fieldName: "document",
				mimeType: "application/vnd.sqlite3",
				parameters: { chat_id: config.chatId, caption: caption(payload, now) },
				// The answer is needed in this run to record the outcome; a
				// background session can outlive the JS that's waiting for it.
				sessionType: "foreground",
			});
		} catch (e) {
			console.warn("[telegram] upload failed", e);
			return {
				ok: false,
				error: "Telegramga ulanib bo'lmadi. Internet aloqasini tekshiring.",
			};
		}

		let body: unknown = null;
		try {
			body = JSON.parse(response.body);
		} catch {
			// Not JSON — a proxy's error page, say. Falls through to the status.
		}
		if (isRecord(body) && body.ok === true) return { ok: true, sentAt: Date.now() };
		const description =
			isRecord(body) && typeof body.description === "string" ? body.description : "";
		return { ok: false, error: explainError(response.status, description) };
	} finally {
		try {
			if (file.exists) file.delete();
		} catch {
			// The cache directory is the OS's to clear; a leftover is harmless.
		}
	}
}

let inFlight: Promise<SendResult> | null = null;

/**
 * Sends the ledger now and records the outcome. Never throws — every failure
 * comes back as a message fit to show the user.
 *
 * A send already under way is joined rather than doubled: the daily check can
 * fire while the user is pressing the button.
 */
export function sendTelegramBackup(
	config: TelegramConfig,
	payload: BackupPayload,
): Promise<SendResult> {
	if (inFlight) return inFlight;
	inFlight = (async () => {
		const now = new Date();
		// Written before the upload, so a second runtime (the background task)
		// sees the attempt and holds off for the retry window.
		await setSetting(KEY_LAST_ATTEMPT, String(now.getTime()));
		const result = await upload(config, payload, now).catch((e): SendResult => {
			console.warn("[telegram] backup failed", e);
			return { ok: false, error: "Zaxira nusxani yuborib bo'lmadi." };
		});
		if (result.ok) {
			await Promise.all([
				setSetting(KEY_LAST_SENT, String(result.sentAt)),
				removeSetting(KEY_LAST_ERROR),
			]);
		} else {
			await setSetting(KEY_LAST_ERROR, result.error);
		}
		return result;
	})().finally(() => {
		inFlight = null;
	});
	return inFlight;
}
