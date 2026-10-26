import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { ChartKind, Dimension } from "@/lib/stats";
import { getSetting, setSetting } from "@/lib/storage";

const KEY_HIDE_INCOME = "hide_income";
const KEY_INCLUDE_DEBTS = "include_debts_in_stats";
const KEY_SPLIT_INCOME = "split_income";
const KEY_STATS_CHART = "stats_chart";
const KEY_STATS_FLOW_CHART = "stats_flow_chart";
const KEY_STATS_LEVEL = "stats_level";
const KEY_REMINDERS = "debt_reminders";

/**
 * When debt reminders go off: how many days before the due date, and at what
 * hour of that day. Whether a debt has one at all is its own `remind` switch.
 */
export type ReminderSettings = {
	/** Off silences every reminder without touching the debts' own switches. */
	enabled: boolean;
	/** 0 is the due date itself. */
	daysBefore: number;
	hour: number;
};

export const REMINDER_DAY_OPTIONS = [0, 1, 3] as const;
export const REMINDER_HOUR_OPTIONS = [9, 13, 20] as const;

const DEFAULT_REMINDERS: ReminderSettings = { enabled: true, daysBefore: 1, hour: 9 };

function asReminderSettings(value: string): ReminderSettings {
	try {
		const raw = JSON.parse(value) as Partial<ReminderSettings>;
		return {
			enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_REMINDERS.enabled,
			daysBefore: (REMINDER_DAY_OPTIONS as readonly number[]).includes(raw.daysBefore ?? -1)
				? (raw.daysBefore as number)
				: DEFAULT_REMINDERS.daysBefore,
			hour:
				typeof raw.hour === "number" && raw.hour >= 0 && raw.hour <= 23
					? raw.hour
					: DEFAULT_REMINDERS.hour,
		};
	} catch {
		return DEFAULT_REMINDERS;
	}
}

const DEFAULT_STATS_CHART: ChartKind = "bar";
const DEFAULT_STATS_FLOW_CHART: ChartKind = "line";
const DEFAULT_STATS_DIMENSION: Dimension = "category";

/** Also reads the kinds an older version stored: its stacked "trend" is the
 *  line chart now, and the pie it offered is gone. */
function asChartKind(value: string, fallback: ChartKind): ChartKind {
	if (value === "line" || value === "trend") return "line";
	if (value === "bar" || value === "pie") return "bar";
	return fallback;
}

function asDimension(value: string): Dimension {
	return value === "category" || value === "subcategory" || value === "wallet"
		? value
		: DEFAULT_STATS_DIMENSION;
}

type PreferencesContextType = {
	/** Masks income amounts — and anything derived from them, like the net
	 *  balance — across every screen. Toggled from an eye icon, remembered
	 *  across restarts. */
	hideIncome: boolean;
	toggleHideIncome: () => void;
	/** Whether debt categories (borrowing, lending, collection, repayment)
	 *  count toward income/expense stats. Off by default — see
	 *  DEBT_CATEGORY_IDS in lib/seed.ts for which categories these are. */
	includeDebtsInStats: boolean;
	setIncludeDebtsInStats: (value: boolean) => void;
	/** Whether income is divided across the wallets by default. On unless the
	 *  user turns it off; an individual entry can still opt out (or, with it
	 *  off, name a wallet to receive the whole amount). */
	splitIncome: boolean;
	setSplitIncome: (value: boolean) => void;
	/** How the Tahlil screen draws its two charts — the composition and the
	 *  income-vs-expense run — and what the composition groups by. Whichever
	 *  the user last picked, remembered across restarts. */
	statsChart: ChartKind;
	setStatsChart: (kind: ChartKind) => void;
	statsFlowChart: ChartKind;
	setStatsFlowChart: (kind: ChartKind) => void;
	statsDimension: Dimension;
	setStatsDimension: (dimension: Dimension) => void;
	/** When debt reminders are sent. See lib/debtReminders.ts. */
	reminders: ReminderSettings;
	setReminders: (next: ReminderSettings) => void;
};

const PreferencesContext = createContext<PreferencesContextType>({
	hideIncome: false,
	toggleHideIncome: () => {},
	includeDebtsInStats: false,
	setIncludeDebtsInStats: () => {},
	splitIncome: true,
	setSplitIncome: () => {},
	statsChart: DEFAULT_STATS_CHART,
	setStatsChart: () => {},
	statsFlowChart: DEFAULT_STATS_FLOW_CHART,
	setStatsFlowChart: () => {},
	statsDimension: DEFAULT_STATS_DIMENSION,
	setStatsDimension: () => {},
	reminders: DEFAULT_REMINDERS,
	setReminders: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [hideIncome, setHideIncomeState] = useState(false);
	const [includeDebtsInStats, setIncludeDebtsInStatsState] = useState(false);
	const [splitIncome, setSplitIncomeState] = useState(true);
	const [statsChart, setStatsChartState] = useState(DEFAULT_STATS_CHART);
	const [statsFlowChart, setStatsFlowChartState] = useState(DEFAULT_STATS_FLOW_CHART);
	const [statsDimension, setStatsDimensionState] = useState(DEFAULT_STATS_DIMENSION);
	const [reminders, setRemindersState] = useState(DEFAULT_REMINDERS);

	useEffect(() => {
		getSetting(KEY_HIDE_INCOME, "0").then((value) => setHideIncomeState(value === "1"));
		getSetting(KEY_INCLUDE_DEBTS, "0").then((value) =>
			setIncludeDebtsInStatsState(value === "1"),
		);
		getSetting(KEY_SPLIT_INCOME, "1").then((value) => setSplitIncomeState(value !== "0"));
		getSetting(KEY_STATS_CHART, DEFAULT_STATS_CHART).then((value) =>
			setStatsChartState(asChartKind(value, DEFAULT_STATS_CHART)),
		);
		getSetting(KEY_STATS_FLOW_CHART, DEFAULT_STATS_FLOW_CHART).then((value) =>
			setStatsFlowChartState(asChartKind(value, DEFAULT_STATS_FLOW_CHART)),
		);
		getSetting(KEY_STATS_LEVEL, DEFAULT_STATS_DIMENSION).then((value) =>
			setStatsDimensionState(asDimension(value)),
		);
		getSetting(KEY_REMINDERS, JSON.stringify(DEFAULT_REMINDERS)).then((value) =>
			setRemindersState(asReminderSettings(value)),
		);
	}, []);

	const toggleHideIncome = useCallback(() => {
		setHideIncomeState((prev) => {
			const next = !prev;
			setSetting(KEY_HIDE_INCOME, next ? "1" : "0");
			return next;
		});
	}, []);

	const setIncludeDebtsInStats = useCallback((value: boolean) => {
		setIncludeDebtsInStatsState(value);
		setSetting(KEY_INCLUDE_DEBTS, value ? "1" : "0");
	}, []);

	const setSplitIncome = useCallback((value: boolean) => {
		setSplitIncomeState(value);
		setSetting(KEY_SPLIT_INCOME, value ? "1" : "0");
	}, []);

	const setStatsChart = useCallback((kind: ChartKind) => {
		setStatsChartState(kind);
		setSetting(KEY_STATS_CHART, kind);
	}, []);

	const setStatsFlowChart = useCallback((kind: ChartKind) => {
		setStatsFlowChartState(kind);
		setSetting(KEY_STATS_FLOW_CHART, kind);
	}, []);

	const setStatsDimension = useCallback((dimension: Dimension) => {
		setStatsDimensionState(dimension);
		setSetting(KEY_STATS_LEVEL, dimension);
	}, []);

	const setReminders = useCallback((next: ReminderSettings) => {
		setRemindersState(next);
		setSetting(KEY_REMINDERS, JSON.stringify(next));
	}, []);

	return (
		<PreferencesContext.Provider
			value={{
				hideIncome,
				toggleHideIncome,
				includeDebtsInStats,
				setIncludeDebtsInStats,
				splitIncome,
				setSplitIncome,
				statsChart,
				setStatsChart,
				statsFlowChart,
				setStatsFlowChart,
				statsDimension,
				setStatsDimension,
				reminders,
				setReminders,
			}}
		>
			{children}
		</PreferencesContext.Provider>
	);
}

export function usePreferences() {
	return useContext(PreferencesContext);
}
