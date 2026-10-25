import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";
import type { BackupPayload } from "@/lib/backup";
import { DEFAULT_UNIT } from "@/lib/money";
import { SEED_CATEGORIES } from "@/lib/seed";
import {
	getJSON,
	getSetting,
	KEY_CATEGORIES,
	KEY_CONTACTS,
	KEY_DEBTS,
	KEY_MEMBERS,
	KEY_TEMPLATES,
	KEY_TRANSACTIONS,
	KEY_TRANSFERS,
	KEY_UNIT,
	KEY_WALLETS,
} from "@/lib/storage";
import {
	isBackupDue,
	isTelegramConfigured,
	loadTelegramConfig,
	loadTelegramStatus,
	sendTelegramBackup,
	type TelegramConfig,
} from "@/lib/telegramBackup";
import type {
	Category,
	Contact,
	Debt,
	FamilyMember,
	Transaction,
	TransactionTemplate,
	Transfer,
	Wallet,
} from "@/lib/types";
import { SEED_WALLETS } from "@/lib/wallets";

/**
 * The daily Telegram backup while the app isn't open.
 *
 * The OS decides when this actually runs — Android's WorkManager every few
 * hours at best, iOS far less predictably, often overnight — so it is asked to
 * wake several times a day and does nothing unless today's backup is still
 * owed. The same check runs whenever the app comes to the foreground
 * (TelegramBackupContext), which is what keeps "daily" true on a phone the OS
 * rarely wakes.
 *
 * It runs without the React tree — on Android with no UI at all, when the app
 * was closed — so it reads the ledger straight from storage rather than from
 * LedgerContext. That is also why this module is imported from the entry file
 * (index.ts) and not from a screen: no route is loaded when the OS starts the
 * bundle headless, and an undefined task is dropped.
 */

const BACKUP_TASK = "taqsim-telegram-backup";

/** A minimum, not a schedule — see above. */
const WAKE_INTERVAL_MINUTES = 6 * 60;

/** The ledger as LedgerContext last stored it. */
async function readStoredPayload(): Promise<BackupPayload> {
	const [
		categories,
		transactions,
		wallets,
		transfers,
		contacts,
		debts,
		templates,
		members,
		defaultUnit,
	] = await Promise.all([
		getJSON<Category[] | null>(KEY_CATEGORIES, null),
		getJSON<Transaction[]>(KEY_TRANSACTIONS, []),
		getJSON<Wallet[] | null>(KEY_WALLETS, null),
		getJSON<Transfer[]>(KEY_TRANSFERS, []),
		getJSON<Contact[]>(KEY_CONTACTS, []),
		getJSON<Debt[]>(KEY_DEBTS, []),
		getJSON<TransactionTemplate[]>(KEY_TEMPLATES, []),
		getJSON<FamilyMember[]>(KEY_MEMBERS, []),
		getSetting(KEY_UNIT, DEFAULT_UNIT),
	]);
	// Null only before the app has ever saved — the same reading LedgerContext
	// gives it on first launch.
	return {
		categories: categories ?? SEED_CATEGORIES,
		transactions,
		wallets: wallets ?? SEED_WALLETS,
		transfers,
		contacts,
		debts,
		templates,
		members,
		defaultUnit,
	};
}

TaskManager.defineTask(BACKUP_TASK, async () => {
	try {
		const [config, status] = await Promise.all([loadTelegramConfig(), loadTelegramStatus()]);
		if (!isBackupDue(config, status)) return BackgroundTask.BackgroundTaskResult.Success;
		const result = await sendTelegramBackup(config, await readStoredPayload());
		return result.ok
			? BackgroundTask.BackgroundTaskResult.Success
			: BackgroundTask.BackgroundTaskResult.Failed;
	} catch (e) {
		console.warn("[backup] background backup failed", e);
		return BackgroundTask.BackgroundTaskResult.Failed;
	}
});

/**
 * Registers the background task when the daily backup is on and set up, and
 * removes it otherwise. Safe to call on every launch and every settings save.
 */
export async function syncBackupTask(config: TelegramConfig): Promise<void> {
	try {
		const status = await BackgroundTask.getStatusAsync();
		if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

		const wanted = config.auto && isTelegramConfigured(config);
		const registered = await TaskManager.isTaskRegisteredAsync(BACKUP_TASK);
		if (wanted && !registered) {
			await BackgroundTask.registerTaskAsync(BACKUP_TASK, {
				minimumInterval: WAKE_INTERVAL_MINUTES,
			});
		} else if (!wanted && registered) {
			await BackgroundTask.unregisterTaskAsync(BACKUP_TASK);
		}
	} catch (e) {
		// The foreground check still covers the day, so this costs reliability,
		// not the feature.
		console.warn("[backup] failed to schedule the daily backup", e);
	}
}
