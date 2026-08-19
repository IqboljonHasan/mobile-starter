import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import type {
	LayoutChangeEvent,
	NativeScrollEvent,
	NativeSyntheticEvent,
} from "react-native";

type ShadowState = { scrolled: boolean; overflow: boolean };
const ZERO: ShadowState = { scrolled: false, overflow: false };

type Ctx = {
	activeKey: string | null;
	setActiveKey: (key: string | null) => void;
	getState: (key: string) => ShadowState;
	setState: (key: string, partial: Partial<ShadowState>) => void;
};

const TabScrollShadowCtx = createContext<Ctx | null>(null);

/**
 * Tracks, per screen, whether its list is scrolled off the top (`scrolled`) and
 * whether content still runs past the bottom (`overflow`) — so the header and
 * the bottom tab bar can each raise a shadow only when there's something
 * underneath it. The tab bar and header live outside the scrolling screen, so
 * they can't observe this themselves.
 */
export function TabScrollShadowProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [activeKey, setActiveKey] = useState<string | null>(null);
	const [stateMap, setStateMap] = useState<Record<string, ShadowState>>({});

	const setState = useCallback((key: string, partial: Partial<ShadowState>) => {
		setStateMap((prev) => {
			const current = prev[key] ?? ZERO;
			const next = { ...current, ...partial };
			if (
				current.scrolled === next.scrolled &&
				current.overflow === next.overflow
			)
				return prev;
			return { ...prev, [key]: next };
		});
	}, []);

	const getState = useCallback(
		(key: string) => stateMap[key] ?? ZERO,
		[stateMap],
	);

	const value = useMemo(
		() => ({ activeKey, setActiveKey, getState, setState }),
		[activeKey, getState, setState],
	);

	return (
		<TabScrollShadowCtx.Provider value={value}>
			{children}
		</TabScrollShadowCtx.Provider>
	);
}

/** Read the shadow state of whichever screen is currently active. */
export function useActiveTabShadow(): ShadowState {
	const ctx = useContext(TabScrollShadowCtx);
	if (!ctx || !ctx.activeKey) return ZERO;
	return ctx.getState(ctx.activeKey);
}

/** Set the currently active shadow key (the screen the user is looking at). */
export function useSetActiveShadowKey() {
	const ctx = useContext(TabScrollShadowCtx);
	return ctx?.setActiveKey ?? (() => {});
}

/**
 * Use on a ScrollView/FlatList to report scroll + overflow state for `key`.
 * Spread the returned object onto the list:
 *
 *   const shadow = useTabScrollShadow("home");
 *   <ScrollView {...shadow} />
 */
export function useTabScrollShadow(key: string, threshold = 4) {
	const ctx = useContext(TabScrollShadowCtx);
	const scrollY = useRef(0);
	const layoutH = useRef(0);
	const contentH = useRef(0);
	const lastRef = useRef<ShadowState>(ZERO);

	const recompute = useCallback(() => {
		if (!ctx || !key) return;
		const next: ShadowState = {
			scrolled: scrollY.current > threshold,
			overflow:
				contentH.current - layoutH.current - scrollY.current > 1 &&
				layoutH.current > 0,
		};
		if (
			next.scrolled === lastRef.current.scrolled &&
			next.overflow === lastRef.current.overflow
		)
			return;
		lastRef.current = next;
		ctx.setState(key, next);
	}, [ctx, key, threshold]);

	const onScroll = useCallback(
		(e: NativeSyntheticEvent<NativeScrollEvent>) => {
			scrollY.current = e.nativeEvent.contentOffset.y;
			layoutH.current = e.nativeEvent.layoutMeasurement.height;
			contentH.current = e.nativeEvent.contentSize.height;
			recompute();
		},
		[recompute],
	);

	const onContentSizeChange = useCallback(
		(_w: number, h: number) => {
			contentH.current = h;
			recompute();
		},
		[recompute],
	);

	const onLayout = useCallback(
		(e: LayoutChangeEvent) => {
			layoutH.current = e.nativeEvent.layout.height;
			recompute();
		},
		[recompute],
	);

	return useMemo(
		() => ({
			scrollEventThrottle: 16,
			onScroll,
			onContentSizeChange,
			onLayout,
		}),
		[onScroll, onContentSizeChange, onLayout],
	);
}

/** Mark `key` as the active screen for as long as this hook is mounted with `enabled`. */
export function useActiveShadowKey(key: string, enabled: boolean) {
	const setActive = useSetActiveShadowKey();
	useEffect(() => {
		if (enabled) setActive(key);
	}, [key, enabled, setActive]);
}
