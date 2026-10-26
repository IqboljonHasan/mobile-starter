import { useState } from "react";
import { Alert } from "react-native";
import { useLedger } from "@/contexts/LedgerContext";
import { shareBackup } from "@/lib/backupFile";

/**
 * Shares the ledger as a .db file through the system share sheet — from the
 * Settings row, and from the Telegram screen while no bot is connected.
 * Failures are reported here; a closed sheet says nothing, since it can't tell
 * a share from a change of mind.
 */
export function useBackupShare() {
	const {
		categories,
		transactions,
		wallets,
		transfers,
		contacts,
		debts,
		templates,
		members,
		defaultUnit,
	} = useLedger();
	const [sharing, setSharing] = useState(false);

	const share = async () => {
		if (sharing) return;
		setSharing(true);
		try {
			const result = await shareBackup({
				categories,
				transactions,
				wallets,
				transfers,
				contacts,
				debts,
				templates,
				members,
				defaultUnit,
			});
			if (result.status === "unavailable") {
				Alert.alert("Ulashib bo'lmadi", "Bu qurilmada fayl ulashish imkoni yo'q.");
			}
		} catch (e) {
			console.warn("[backup] failed to share", e);
			Alert.alert("Ulashib bo'lmadi", "Zaxira faylini yaratib bo'lmadi.");
		} finally {
			setSharing(false);
		}
	};

	return { sharing, share };
}
