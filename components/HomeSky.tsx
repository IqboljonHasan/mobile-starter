import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "@/hooks/useTheme";
import { homePalette } from "@/lib/theme";

/**
 * The home screen's backdrop: the brand blue at the top easing into a warm
 * sand at the bottom, with two soft glows behind the frosted panels so they
 * have something to be frosted over. Drawn in SVG — a radial gradient fading
 * to nothing is how a blurred circle is made without a blur filter.
 */
export default function HomeSky() {
	const { isDark } = useTheme();
	const sky = homePalette(isDark);

	return (
		<View pointerEvents="none" style={StyleSheet.absoluteFill}>
			<Svg width="100%" height="100%">
				<Defs>
					<LinearGradient id="home-sky" x1="0" y1="0" x2="0" y2="1">
						{sky.stops.map((stop) => (
							<Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
						))}
					</LinearGradient>
					<RadialGradient id="home-glow-cool" cx="50%" cy="50%" r="50%">
						<Stop offset="0" stopColor={sky.glowCool} stopOpacity={0.75} />
						<Stop offset="1" stopColor={sky.glowCool} stopOpacity={0} />
					</RadialGradient>
					<RadialGradient id="home-glow-warm" cx="50%" cy="50%" r="50%">
						<Stop offset="0" stopColor={sky.glowWarm} stopOpacity={0.85} />
						<Stop offset="1" stopColor={sky.glowWarm} stopOpacity={0} />
					</RadialGradient>
				</Defs>
				<Rect x="0" y="0" width="100%" height="100%" fill="url(#home-sky)" />
				<Circle cx="8%" cy="52%" r="220" fill="url(#home-glow-cool)" />
				<Circle cx="100%" cy="68%" r="240" fill="url(#home-glow-warm)" />
			</Svg>
		</View>
	);
}
