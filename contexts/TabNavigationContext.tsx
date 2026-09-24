import { createContext, type ReactNode, useContext, useMemo } from "react";

export type TabKey = "home" | "income" | "expense" | "debts";

type TabNavigationContextType = {
	/** Move the pager to the given tab. */
	goToTab: (key: TabKey) => void;
};

const TabNavigationContext = createContext<TabNavigationContextType>({
	goToTab: () => {},
});

/**
 * Lets a tab screen move the pager to a sibling tab.
 *
 * The pager — not the router — owns which tab is showing, so `router.push`
 * can't reach a sibling tab. This passes the pager's page setter down instead.
 */
export function TabNavigationProvider({
	onRequestTab,
	children,
}: {
	onRequestTab: (key: TabKey) => void;
	children: ReactNode;
}) {
	const value = useMemo(() => ({ goToTab: onRequestTab }), [onRequestTab]);

	return (
		<TabNavigationContext.Provider value={value}>
			{children}
		</TabNavigationContext.Provider>
	);
}

export function useTabNavigation() {
	return useContext(TabNavigationContext);
}
