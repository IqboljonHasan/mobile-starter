import { useEffect } from "react";
import { Pressable, View } from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

const TRACK_W = 48;
const TRACK_H = 28;
const THUMB = 24;
const INSET = 2;

/**
 * The app's switch, drawn the same on both platforms: an ink track when on, a
 * grey one when off. The touch target is a full 44px tall even though the
 * track is 28, so it is as easy to hit as any other control.
 */
export function Toggle({
	value,
	onValueChange,
	accessibilityLabel,
	disabled = false,
}: {
	value: boolean;
	onValueChange: (next: boolean) => void;
	accessibilityLabel: string;
	disabled?: boolean;
}) {
	const { tc, isDark } = useTheme();
	const progress = useSharedValue(value ? 1 : 0);

	useEffect(() => {
		progress.set(withTiming(value ? 1 : 0, { duration: 160 }));
	}, [value, progress]);

	const thumbStyle = useAnimatedStyle(() => ({
		transform: [{ translateX: progress.get() * (TRACK_W - THUMB - INSET * 2) }],
	}));

	return (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ checked: value, disabled }}
			disabled={disabled}
			onPress={() => onValueChange(!value)}
			className="items-center justify-center"
			style={{ width: 56, height: 44, opacity: disabled ? 0.4 : 1 }}
		>
			<View
				style={{
					width: TRACK_W,
					height: TRACK_H,
					borderRadius: TRACK_H / 2,
					backgroundColor: value ? tc.primary : tc.disabled,
					padding: INSET,
				}}
			>
				<Animated.View
					style={[
						{
							width: THUMB,
							height: THUMB,
							borderRadius: THUMB / 2,
							// On the light "on" track of the dark theme a white thumb
							// would vanish, so it takes the sheet's own dark there.
							backgroundColor: value && isDark ? tc.background : "#fff",
							shadowColor: "#000",
							shadowOffset: { width: 0, height: 1 },
							shadowOpacity: 0.25,
							shadowRadius: 1.5,
							elevation: 2,
						},
						thumbStyle,
					]}
				/>
			</View>
		</Pressable>
	);
}
