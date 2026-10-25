import { useEffect } from "react";
import { View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

const HEIGHT = 6;

/**
 * The shade along the top edge of a scrolling area, shown once its content
 * has scrolled — the sign that rows are passing under whatever stays fixed
 * above (a header, a filter bar).
 *
 * Drawn as a gradient inside the scrolling area rather than as a shadow on
 * the fixed element: a native shadow falls on every side of its view, so it
 * showed above the element as well as below it. Place it as the last child of
 * a container that holds the scrollable, so it paints over the rows.
 */
export default function ScrollShadow({ visible, top = 0 }: { visible: boolean; top?: number }) {
	const { isDark } = useTheme();
	const opacity = useSharedValue(0);

	useEffect(() => {
		opacity.set(withTiming(visible ? 1 : 0, { duration: 160 }));
	}, [visible, opacity]);

	const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
	const color = isDark ? "#000000" : "#0b1b2e";

	return (
		<Animated.View
			pointerEvents="none"
			style={[{ position: "absolute", top, left: 0, right: 0, height: HEIGHT, zIndex: 5 }, style]}
		>
			<View style={{ flex: 1 }}>
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id="scroll-shadow" x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor={color} stopOpacity={isDark ? 0.45 : 0.12} />
							<Stop offset="1" stopColor={color} stopOpacity={0} />
						</LinearGradient>
					</Defs>
					<Rect x="0" y="0" width="100%" height="100%" fill="url(#scroll-shadow)" />
				</Svg>
			</View>
		</Animated.View>
	);
}
