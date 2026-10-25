import { useCallback, useEffect, useRef, useState } from "react";
import {
	type CellRendererProps,
	type NativeScrollEvent,
	type NativeSyntheticEvent,
	View,
} from "react-native";

/**
 * Which fixed edge the content is passing under: none (at the top), the stuck
 * section header, or the top of the list itself — whatever sits above it, a
 * filter bar.
 */
export type ShadowEdge = "none" | "header" | "top";

/**
 * `useScrolled` for a list whose section headers stick, which has two edges
 * things pass under. Once it scrolls, the rows pass under the stuck header,
 * so the shade belongs below that. While the next header pushes the stuck
 * one out, it's the header that passes under the top of the list, so the
 * shade moves up there until the new one has settled.
 *
 * Every section must end in a footer (`renderSectionFooter`) and every header
 * be `headerHeight` tall: a stuck header can't be measured where it sits in
 * the list, but the footer before it can, and the header starts where that
 * ends. Spread the result's `listProps` onto the SectionList.
 */
export function useStickyHeaderShadow(headerHeight: number) {
	const [edge, setEdge] = useState<ShadowEdge>("none");
	// Where each rendered footer ends in the list's content, by its cell key.
	// Only the footers near the top matter, and those are always rendered.
	const footerEnds = useRef(new Map<string, number>());

	const onScroll = useCallback(
		(e: Pick<NativeSyntheticEvent<NativeScrollEvent>, "nativeEvent">) => {
			const y = e.nativeEvent.contentOffset.y;
			let next: ShadowEdge = "none";
			if (y > 2) {
				next = "header";
				for (const end of footerEnds.current.values()) {
					// A header starting within the stuck one's height of the top
					// is pushing it out.
					if (end > y && end < y + headerHeight) {
						next = "top";
						break;
					}
				}
			}
			setEdge((prev) => (prev === next ? prev : next));
		},
		[headerHeight],
	);

	// The list's own cell, which also notes where footers end. Made once, so
	// the list never sees a new component type and remounts its rows.
	const [CellRendererComponent] = useState(
		() =>
			function MeasuredCell({ cellKey, index: _index, item: _item, onLayout, ...rest }: CellRendererProps<unknown>) {
				const isFooter = cellKey.endsWith(":footer");
				useEffect(() => {
					if (!isFooter) return;
					const ends = footerEnds.current;
					return () => {
						ends.delete(cellKey);
					};
				}, [cellKey, isFooter]);

				return (
					<View
						{...rest}
						onLayout={(e) => {
							onLayout?.(e);
							if (!isFooter) return;
							const { y, height } = e.nativeEvent.layout;
							footerEnds.current.set(cellKey, y + height);
						}}
					/>
				);
			},
	);

	return { edge, listProps: { onScroll, scrollEventThrottle: 16, CellRendererComponent } };
}
