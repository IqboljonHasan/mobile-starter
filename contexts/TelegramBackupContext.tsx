import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState } from "react-native";
import { useLedger } from "@/contexts/LedgerContext";
import type { BackupPayload } from "@/lib/backup";
import { syncBackupTask } from "@/lib/backupTask";
import {
	EMPTY_TELEGRAM_CONFIG,
	EMPTY_TELEGRAM_STATUS,
	isBackupDue,
	isTelegramConfigured,
	loadTelegramConfig,
	loadTelegramStatus,
	saveTelegramConfig,
	type SendResult,
	sendTelegramBackup,
	type TelegramConfig,
	type TelegramStatus,
} from "@/lib/telegramBackup";

/**
 * The Telegram backup's settings and last outcome, plus the foreground half of
 * the daily schedule: each time the app comes to the front, today's backup is
 * sent if it's still owed. The background half is lib/backupTask.ts.
 */

/** Lets the first screen settle before a backup is built on the JS thread. */
const FOREGROUND_CHECK_DELAY_MS = 3000;

type TelegramBackupContextType = {
	/** False until the stored settings have been read. */
	loaded: boolean;
	config: TelegramConfig;
	status: TelegramStatus;
	/** A token and a chat are both saved. */
	configured: boolean;
	sending: boolean;
	saveConfig: (config: TelegramConfig) => Promise<void>;
	/** Sends the ledger as it is right now, whatever the daily schedule says. */
	sendNow: () => Promise<SendResult>;
};

const TelegramBackupContext = createContext<TelegramBackupContextType | null>(null);

export function TelegramBackupProvider({ children }: { children: ReactNode }) {
	const {
		ready,
		categories,
		transactions,
		wallets,
		transfers,
		contacts,
		debts,
		templates,
		defaultUnit,
	} =
		useLedger();
	const [loaded, setLoaded] = useState(false);
	const [config, setConfig] = useState(EMPTY_TELEGRAM_CONFIG);
	const [status, setStatus] = useState(EMPTY_TELEGRAM_STATUS);
	const [sending, setSending] = useState(false);

	// The send reads whatever is current when it runs — not what a callback
	// closed over when it was made, which for the AppState listener could be
	// long ago.
	const configRef = useRef(config);
	const payloadRef = useRef<BackupPayload | null>(null);
	useEffect(() => {
		payloadRef.current = {
			categories,
			transactions,
			wallets,
			transfers,
			contacts,
			debts,
			templates,
			defaultUnit,
		};
	}, [categories, transactions, wallets, transfers, contacts, debts, templates, defaultUnit]);

	useEffect(() => {
		Promise.all([loadTelegramConfig(), loadTelegramStatus()]).then(
			([storedConfig, storedStatus]) => {
				configRef.current = storedConfig;
				setConfig(storedConfig);
				setStatus(storedStatus);
				setLoaded(true);
				// Re-asserted on every launch: registration lives in the OS and
				// can be lost to a reinstall or a cleared app.
				syncBackupTask(storedConfig);
			},
		);
	}, []);

	const send = useCallback(async (): Promise<SendResult> => {
		const payload = payloadRef.current;
		if (!payload) return { ok: false, error: "Ma'lumotlar hali yuklanmadi." };
		setSending(true);
		try {
			const result = await sendTelegramBackup(configRef.current, payload);
			setStatus(await loadTelegramStatus());
			return result;
		} finally {
			setSending(false);
		}
	}, []);

	useEffect(() => {
		if (!loaded || !ready) return;

		const check = async () => {
			// Re-read rather than trusting state: the background task may have
			// sent today's backup while the app was out of sight.
			const latest = await loadTelegramStatus();
			setStatus(latest);
			if (isBackupDue(configRef.current, latest)) await send();
		};

		const timer = setTimeout(check, FOREGROUND_CHECK_DELAY_MS);
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") check();
		});
		return () => {
			clearTimeout(timer);
			subscription.remove();
		};
	}, [loaded, ready, send]);

	const saveConfig = useCallback(async (next: TelegramConfig) => {
		configRef.current = next;
		setConfig(next);
		await saveTelegramConfig(next);
		await syncBackupTask(next);
	}, []);

	const value = useMemo(
		() => ({
			loaded,
			config,
			status,
			configured: isTelegramConfigured(config),
			sending,
			saveConfig,
			sendNow: send,
		}),
		[loaded, config, status, sending, saveConfig, send],
	);

	return (
		<TelegramBackupContext.Provider value={value}>{children}</TelegramBackupContext.Provider>
	);
}

export function useTelegramBackup() {
	const context = useContext(TelegramBackupContext);
	if (!context) {
		throw new Error("useTelegramBackup must be used inside TelegramBackupProvider");
	}
	return context;
}
