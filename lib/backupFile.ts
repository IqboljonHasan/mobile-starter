import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
	type BackupPayload,
	backupFileName,
	isSqliteFile,
	type ParseResult,
	parseBackupData,
} from "@/lib/backup";
import { readBackupDb, serializeBackupDb } from "@/lib/backupDb";

/**
 * Getting a .db backup out of the app through the share sheet, and back in
 * through the file picker.
 *
 * The format itself lives in lib/backup.ts and lib/backupDb.ts; this is only
 * the part that touches the filesystem.
 */

export type ShareResult = { status: "opened" } | { status: "unavailable" };

export type LoadResult =
	| { status: "loaded"; payload: BackupPayload; skipped: number; hasWallets: boolean }
	| { status: "invalid"; error: string }
	| { status: "canceled" };

/**
 * Hands the ledger to the system share sheet as a .db file — to Telegram,
 * Drive, "Save to Files", wherever the user picks. Every directory the app can
 * write to unaided is inside its own sandbox, which is erased along with the
 * app — the one place a backup must not stay.
 *
 * The sheet doesn't say whether anything was actually shared, only that it
 * closed, so there's no "saved" to report back.
 */
export async function shareBackup(payload: BackupPayload): Promise<ShareResult> {
	if (!(await Sharing.isAvailableAsync())) return { status: "unavailable" };

	// The file has to outlive the sheet: the app it goes to may read it only
	// after the sheet has closed. So the previous export is cleared here
	// instead of this one afterwards, which keeps at most one in the cache.
	const directory = new Directory(Paths.cache, "share");
	if (directory.exists) directory.delete();
	directory.create();

	const now = new Date();
	const file = new File(directory, backupFileName(now));
	file.create();
	file.write(serializeBackupDb(payload, now));

	await Sharing.shareAsync(file.uri, {
		mimeType: "application/vnd.sqlite3",
		UTI: "public.database",
		dialogTitle: "Zaxira nusxani ulashish",
	});
	return { status: "opened" };
}

/**
 * Reads and validates a .db backup the user picks — one shared from Settings
 * or sent by the Telegram backup. Nothing is written here.
 */
export async function loadBackup(): Promise<LoadResult> {
	// Deliberately unfiltered by MIME type: the same file arrives as
	// application/vnd.sqlite3, application/x-sqlite3 or
	// application/octet-stream depending on how it travelled between devices,
	// and a picker that greys out the file the user is looking at leaves them
	// nowhere to go. What was picked is validated below either way.
	//
	// Note this resolves to `canceled` for a genuine failure too — the picker
	// swallows its own errors — so there's no error case to tell apart here.
	const picked = await File.pickFileAsync();
	if (picked.canceled) return { status: "canceled" };

	let parsed: ParseResult;
	try {
		const bytes = await picked.result.bytes();
		if (!isSqliteFile(bytes)) {
			return {
				status: "invalid",
				error: "Bu Taqsim zaxira fayli emas. Faqat .db zaxira nusxadan tiklash mumkin.",
			};
		}
		parsed = parseBackupData(readBackupDb(bytes));
	} catch (error) {
		console.warn("[backup] failed to read the picked file", error);
		return { status: "invalid", error: "Faylni o'qib bo'lmadi." };
	}

	if (!parsed.ok) return { status: "invalid", error: parsed.error };
	return {
		status: "loaded",
		payload: parsed.payload,
		skipped: parsed.skipped,
		hasWallets: parsed.hasWallets,
	};
}
