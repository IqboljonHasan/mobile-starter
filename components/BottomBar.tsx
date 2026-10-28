import { type ReactNode } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";

/**
 * The actions pinned to the bottom of a sheet — "Kirim / Chiqim", or a form's
 * save button. The list scrolls on underneath, fading out into the sheet
 * behind the buttons rather than being cut off at a hard edge.
 *
 * Absolutely positioned, so the scrolling content under it needs roughly
 * `BOTTOM_BAR_SPACE` of bottom padding to be reachable past it — or, exactly,
 * the distance from the list's bottom edge up to the top of the fade, which a
 * screen can work out from `onLayout` and `BOTTOM_BAR_FADE`.
 */
export const BOTTOM_BAR_SPACE = 120;
/** How far the fade reaches up from the bar's bottom edge. */
export const BOTTOM_BAR_FADE = 130;

export default function BottomBar({
	children,
	lift = 0,
	onLayout,
}: {
	children: ReactNode;
	/** Raises the bar — by the keyboard's height, say. */
	lift?: number;
	onLayout?: (e: LayoutChangeEvent) => void;
}) {
	const { tc } = useTheme();

	return (
		<View
			pointerEvents="box-none"
			onLayout={onLayout}
			style={{ position: "absolute", left: 0, right: 0, bottom: lift }}
		>
			<View
				pointerEvents="none"
				style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: BOTTOM_BAR_FADE }}
			>
				<Svg width="100%" height="100%">
					<Defs>
						<LinearGradient id="bottom-bar-fade" x1="0" y1="0" x2="0" y2="1">
							<Stop offset="0" stopColor={tc.background} stopOpacity={0} />
							<Stop offset="0.5" stopColor={tc.background} stopOpacity={1} />
						</LinearGradient>
					</Defs>
					<Rect x="0" y="0" width="100%" height="100%" fill="url(#bottom-bar-fade)" />
				</Svg>
			</View>
			<View className="flex-row" style={{ gap: 4, paddingHorizontal: 18, paddingBottom: 16 }}>
				{children}
			</View>
		</View>
	);
}
