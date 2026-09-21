import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getSetting, setSetting } from "@/lib/storage";

const KEY_HIDE_INCOME = "hide_income";
const KEY_INCLUDE_DEBTS = "include_debts_in_stats";

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
};

const PreferencesContext = createContext<PreferencesContextType>({
	hideIncome: false,
	toggleHideIncome: () => {},
	includeDebtsInStats: false,
	setIncludeDebtsInStats: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [hideIncome, setHideIncomeState] = useState(false);
	const [includeDebtsInStats, setIncludeDebtsInStatsState] = useState(false);

	useEffect(() => {
		getSetting(KEY_HIDE_INCOME, "0").then((value) => setHideIncomeState(value === "1"));
		getSetting(KEY_INCLUDE_DEBTS, "0").then((value) =>
			setIncludeDebtsInStatsState(value === "1"),
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

	return (
		<PreferencesContext.Provider
			value={{
				hideIncome,
				toggleHideIncome,
				includeDebtsInStats,
				setIncludeDebtsInStats,
			}}
		>
			{children}
		</PreferencesContext.Provider>
	);
}

export function usePreferences() {
	return useContext(PreferencesContext);
}
