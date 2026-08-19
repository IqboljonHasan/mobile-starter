import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Animated, Pressable } from "react-native";
import { useTheme } from "@/hooks/useTheme";

export interface IconButtonProps {
	onPress: () => void;
	icon?: keyof typeof Ionicons.glyphMap;
	size?: number;
	/** Icon tint. Defaults to the foreground color. */
	color?: string;
	accessibilityLabel?: string;
}

export function IconButton({
	onPress,
	icon = "arrow-back",
	size = 22,
	color,
	accessibilityLabel,
}: IconButtonProps) {
	const { tc } = useTheme();
	const [scale] = useState(() => new Animated.Value(1));
	const [bgOpacity] = useState(() => new Animated.Value(0));

	const backgroundColor = bgOpacity.interpolate({
		inputRange: [0, 1],
		outputRange: ["rgba(128,128,128,0)", "rgba(128,128,128,1)"],
	});

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? icon}
			onPress={onPress}
			onPressIn={() => {
				Animated.parallel([
					Animated.timing(scale, {
						toValue: 0.82,
						duration: 80,
						useNativeDriver: true,
					}),
					Animated.timing(bgOpacity, {
						toValue: 0.15,
						duration: 80,
						useNativeDriver: false,
					}),
				]).start();
			}}
			onPressOut={() => {
				Animated.parallel([
					Animated.spring(scale, {
						toValue: 1,
						damping: 10,
						stiffness: 300,
						useNativeDriver: true,
					}),
					Animated.timing(bgOpacity, {
						toValue: 0,
						duration: 200,
						useNativeDriver: false,
					}),
				]).start();
			}}
			hitSlop={12}
		>
			{/* Outer view: native-driven scale (transform only). Inner view:
			    JS-driven backgroundColor (color only). Keeping the two drivers on
			    separate views avoids the "node moved to native earlier" crash that
			    happens when one Animated.View mixes them. */}
			<Animated.View style={{ transform: [{ scale }], width: 36, height: 36 }}>
				<Animated.View
					style={{
						flex: 1,
						backgroundColor,
						borderRadius: 18,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Ionicons name={icon} size={size} color={color ?? tc.foreground} />
				</Animated.View>
			</Animated.View>
		</Pressable>
	);
}
