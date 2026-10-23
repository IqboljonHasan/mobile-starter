import { useCallback, useState } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

/**
 * Whether a scroll view has left its top — what `ScrollShadow` is shown by.
 * Spread the result's handler props onto the scrollable. State changes only
 * when the answer does, so scrolling doesn't re-render the screen per frame.
 */
export function useScrolled() {
	const [scrolled, setScrolled] = useState(false);
	const onScroll = useCallback(
		(e: Pick<NativeSyntheticEvent<NativeScrollEvent>, "nativeEvent">) => {
			const next = e.nativeEvent.contentOffset.y > 2;
			setScrolled((prev) => (prev === next ? prev : next));
		},
		[],
	);
	return { scrolled, scrollProps: { onScroll, scrollEventThrottle: 16 } };
}
