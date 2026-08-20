import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import {
	addSchedulesChangedListener,
	canScheduleExactAlarms,
	getLog,
	getPermissions,
	getSimSlots,
	isAvailable,
	isIgnoringBatteryOptimizations,
	listSchedules,
	type PermissionResult,
	requestPermissions,
	type SendLogEntry,
	type SimSlot,
	type SmsSchedule,
} from "@/modules/sms-scheduler";

export type SchedulerState = {
	/** False on iOS, on web, and in Expo Go — the native module isn't there. */
	available: boolean;
	loading: boolean;
	schedules: SmsSchedule[];
	log: SendLogEntry[];
	sims: SimSlot[];
	permission: PermissionResult | null;
	/** Android 14+ withholds this until the user grants "Alarms & reminders". */
	exactAlarms: boolean;
	batteryExempt: boolean;
	refresh: () => Promise<void>;
	askForPermission: () => Promise<PermissionResult | null>;
};

/**
 * Single read of everything the scheduler UI needs.
 *
 * Refreshes on three signals, because all three change state behind the app's
 * back: the native change event (an alarm fired while the screen was open),
 * returning to the foreground (the user just came back from the OS settings
 * screen where they granted exact alarms), and mount.
 */
export function useSmsScheduler(): SchedulerState {
	const available = isAvailable();
	// Nothing to load when the module isn't there, and seeding it that way keeps
	// `refresh` free of any synchronous setState.
	const [loading, setLoading] = useState(available);
	const [schedules, setSchedules] = useState<SmsSchedule[]>([]);
	const [log, setLog] = useState<SendLogEntry[]>([]);
	const [sims, setSims] = useState<SimSlot[]>([]);
	const [permission, setPermission] = useState<PermissionResult | null>(null);
	const [exactAlarms, setExactAlarms] = useState(true);
	const [batteryExempt, setBatteryExempt] = useState(true);

	// Guards setState after unmount — refresh is fired from listeners that
	// outlive a screen being swiped away.
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	const refresh = useCallback(async () => {
		if (!available) return;
		try {
			const [nextSchedules, nextLog, nextSims, nextPermission] =
				await Promise.all([
					listSchedules(),
					getLog(50),
					getSimSlots(),
					getPermissions(),
				]);
			if (!mounted.current) return;
			setSchedules(nextSchedules);
			setLog(nextLog);
			setSims(nextSims);
			setPermission(nextPermission);
			setExactAlarms(canScheduleExactAlarms());
			setBatteryExempt(isIgnoringBatteryOptimizations());
		} catch (e) {
			console.warn("[sms] failed to read scheduler state", e);
		} finally {
			if (mounted.current) setLoading(false);
		}
	}, [available]);

	useEffect(() => {
		if (!available) return;

		const changed = addSchedulesChangedListener(() => {
			refresh();
		});
		const appState = AppState.addEventListener("change", (state) => {
			if (state === "active") refresh();
		});
		// The first read goes through the same door as the other two, one tick
		// out, so state only ever lands from a callback rather than synchronously
		// during the effect.
		const initial = setTimeout(() => {
			refresh();
		}, 0);

		return () => {
			clearTimeout(initial);
			changed?.remove();
			appState.remove();
		};
	}, [available, refresh]);

	const askForPermission = useCallback(async () => {
		if (!available) return null;
		const result = await requestPermissions();
		if (mounted.current) setPermission(result);
		return result;
	}, [available]);

	return {
		available,
		loading,
		schedules,
		log,
		sims,
		permission,
		exactAlarms,
		batteryExempt,
		refresh,
		askForPermission,
	};
}
