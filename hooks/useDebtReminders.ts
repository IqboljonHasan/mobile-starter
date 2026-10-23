import { router } from "expo-router";
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { useLedger } from "@/contexts/LedgerContext";
import { usePreferences } from "@/contexts/PreferencesContext";
import { listenForReminderTaps, syncDebtReminders } from "@/lib/debtReminders";

/** Lets a burst of edits — a debt saved with its payment — settle into one sync. */
const SYNC_DELAY_MS = 600;

/**
 * Keeps the phone's debt reminders in step with the ledger, and opens a debt
 * when its reminder is tapped. Mounted once, at the root.
 *
 * It also syncs each time the app comes back to the front: the permission
 * prompt, and the system settings where it can be granted later, both take
 * the app out of the foreground, and the reminders that couldn't be scheduled
 * without it are scheduled on the way back.
 */
export function useDebtReminders(): void {
	const { ready, debts, contacts } = useLedger();
	const { reminders } = usePreferences();
	const [returns, setReturns] = useState(0);

	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) => {
			if (state === "active") setReturns((n) => n + 1);
		});
		return () => subscription.remove();
	}, []);

	useEffect(() => {
		if (!ready) return;
		const timer = setTimeout(() => {
			syncDebtReminders(debts, contacts, reminders).catch((e) =>
				console.warn("[reminders] sync failed", e),
			);
		}, SYNC_DELAY_MS);
		return () => clearTimeout(timer);
	}, [ready, debts, contacts, reminders, returns]);

	// Only once the ledger is up — a cold start from a tapped reminder has to
	// find the debt it names.
	useEffect(() => {
		if (!ready) return;
		return listenForReminderTaps((debtId) => router.push(`/debt?id=${debtId}`));
	}, [ready]);
}
