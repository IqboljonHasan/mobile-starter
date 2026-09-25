import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import type { BreakdownLevel, ChartKind } from "@/lib/stats";
import { getSetting, setSetting } from "@/lib/storage";

const KEY_HIDE_INCOME = "hide_income";
const KEY_INCLUDE_DEBTS = "include_debts_in_stats";
const KEY_STATS_CHART = "stats_chart";
const KEY_STATS_LEVEL = "stats_level";

const DEFAULT_STATS_CHART: ChartKind = "pie";
const DEFAULT_STATS_LEVEL: BreakdownLevel = "category";

function asChartKind(value: string): ChartKind {
	return value === "trend" || value === "bar" || value === "pie" ? value : DEFAULT_STATS_CHART;
}

function asBreakdownLevel(value: string): BreakdownLevel {
	return value === "category" || value === "subcategory" ? value : DEFAULT_STATS_LEVEL;
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
	/** How the Stats breakdown draws itself, and whether it groups by
	 *  category or subcategory — whichever the user last picked, remembered
	 *  across restarts. */
	statsChart: ChartKind;
	setStatsChart: (kind: ChartKind) => void;
	statsLevel: BreakdownLevel;
	setStatsLevel: (level: BreakdownLevel) => void;
};

const PreferencesContext = createContext<PreferencesContextType>({
	hideIncome: false,
	toggleHideIncome: () => {},
	includeDebtsInStats: false,
	setIncludeDebtsInStats: () => {},
	statsChart: DEFAULT_STATS_CHART,
	setStatsChart: () => {},
	statsLevel: DEFAULT_STATS_LEVEL,
	setStatsLevel: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [hideIncome, setHideIncomeState] = useState(false);
	const [includeDebtsInStats, setIncludeDebtsInStatsState] = useState(false);
	const [statsChart, setStatsChartState] = useState(DEFAULT_STATS_CHART);
	const [statsLevel, setStatsLevelState] = useState(DEFAULT_STATS_LEVEL);

	useEffect(() => {
		getSetting(KEY_HIDE_INCOME, "0").then((value) => setHideIncomeState(value === "1"));
		getSetting(KEY_INCLUDE_DEBTS, "0").then((value) =>
			setIncludeDebtsInStatsState(value === "1"),
		);
		getSetting(KEY_STATS_CHART, DEFAULT_STATS_CHART).then((value) =>
			setStatsChartState(asChartKind(value)),
		);
		getSetting(KEY_STATS_LEVEL, DEFAULT_STATS_LEVEL).then((value) =>
			setStatsLevelState(asBreakdownLevel(value)),
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

	const setStatsChart = useCallback((kind: ChartKind) => {
		setStatsChartState(kind);
		setSetting(KEY_STATS_CHART, kind);
	}, []);

	const setStatsLevel = useCallback((level: BreakdownLevel) => {
		setStatsLevelState(level);
		setSetting(KEY_STATS_LEVEL, level);
	}, []);

	return (
		<PreferencesContext.Provider
			value={{
				hideIncome,
				toggleHideIncome,
				includeDebtsInStats,
				setIncludeDebtsInStats,
				statsChart,
				setStatsChart,
				statsLevel,
				setStatsLevel,
			}}
		>
			{children}
		</PreferencesContext.Provider>
	);
}

export function usePreferences() {
	return useContext(PreferencesContext);
}
