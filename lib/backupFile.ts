import { Directory, File } from "expo-file-system";
import {
	type BackupPayload,
	backupFileName,
	isErrorWithCode,
	parseBackup,
	serializeBackup,
} from "@/lib/backup";

/**
 * Getting a backup out of the app and back in, through the system pickers.
 *
 * The format itself lives in lib/backup.ts; this is only the part that touches
 * the filesystem.
 */

export type SaveResult =
	| { status: "saved"; fileName: string }
	| { status: "canceled" };

export type LoadResult =
	| { status: "loaded"; payload: BackupPayload; skipped: number }
	| { status: "invalid"; error: string }
	| { status: "canceled" };

/** What the folder picker throws when the user backs out of it. */
const PICKER_CANCELLED = "ERR_PICKER_CANCELLED";

/**
 * Writes the ledger into a folder the user picks. Every directory the app can
 * write to unaided is inside its own sandbox, which is erased along with the
 * app — the one place a backup must not be.
 */
export async function saveBackup(payload: BackupPayload): Promise<SaveResult> {
	let directory: Directory;
	try {
		directory = await Directory.pickDirectoryAsync();
	} catch (error) {
		if (isErrorWithCode(error, PICKER_CANCELLED)) return { status: "canceled" };
		throw error;
	}

	const fileName = backupFileName();
	const file = directory.createFile(fileName, "application/json");
	file.write(serializeBackup(payload));
	return { status: "saved", fileName };
}

/** Reads and validates a backup the user picks. Nothing is written here. */
export async function loadBackup(): Promise<LoadResult> {
	// Deliberately unfiltered by MIME type: the same file arrives as
	// application/json, text/plain or application/octet-stream depending on how
	// it travelled between devices, and a picker that greys out the file the
	// user is looking at leaves them nowhere to go. What was picked is validated
	// below either way.
	//
	// Note this resolves to `canceled` for a genuine failure too — the picker
	// swallows its own errors — so there's no error case to tell apart here.
	const picked = await File.pickFileAsync();
	if (picked.canceled) return { status: "canceled" };

	let text: string;
	try {
		text = await picked.result.text();
	} catch (error) {
		console.warn("[backup] failed to read the picked file", error);
		return { status: "invalid", error: "Faylni o'qib bo'lmadi." };
	}

	const parsed = parseBackup(text);
	if (!parsed.ok) return { status: "invalid", error: parsed.error };
	return { status: "loaded", payload: parsed.payload, skipped: parsed.skipped };
}
