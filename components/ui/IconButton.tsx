import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Animated, Pressable } from "react-native";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";

export interface IconButtonProps {
	onPress: () => void;
	icon?: keyof typeof Ionicons.glyphMap;
	size?: number;
	/** Icon tint. Defaults to the foreground color. */
	color?: string;
	/**
	 * `plain` — a bare 36px icon, for inline use. `filled` — a 44px circle on
	 * the muted tone, the way header and switcher buttons are drawn. `glass` —
	 * the same circle, translucent white, for laying over the brand blue.
	 */
	variant?: "plain" | "filled" | "glass";
	disabled?: boolean;
	accessibilityLabel?: string;
}

export function IconButton({
	onPress,
	icon = "arrow-back",
	size = 20,
	color,
	variant = "plain",
	disabled = false,
	accessibilityLabel,
}: IconButtonProps) {
	const { tc } = useTheme();
	const [scale] = useState(() => new Animated.Value(1));
	const [bgOpacity] = useState(() => new Animated.Value(0));
	const handlePress = useGuardedPress(onPress);

	const diameter = variant === "plain" ? 36 : 44;
	const base =
		variant === "filled"
			? tc.muted
			: variant === "glass"
				? "rgba(255,255,255,0.16)"
				: "transparent";

	const overlay = bgOpacity.interpolate({
		inputRange: [0, 1],
		outputRange: ["rgba(128,128,128,0)", "rgba(128,128,128,1)"],
	});

	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? icon}
			accessibilityState={{ disabled }}
			disabled={disabled}
			onPress={handlePress}
			onPressIn={() => {
				Animated.parallel([
					Animated.timing(scale, {
						toValue: 0.88,
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
			hitSlop={variant === "plain" ? 12 : 4}
			style={{ opacity: disabled ? 0.35 : 1 }}
		>
			{/* Outer view: native-driven scale (transform only). Inner views:
			    JS-driven colors only. Keeping the two drivers on separate views
			    avoids the "node moved to native earlier" crash that happens when
			    one Animated.View mixes them. */}
			<Animated.View
				style={{
					transform: [{ scale }],
					width: diameter,
					height: diameter,
					borderRadius: diameter / 2,
					backgroundColor: base,
					overflow: "hidden",
				}}
			>
				<Animated.View
					style={{
						flex: 1,
						backgroundColor: overlay,
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Ionicons
						name={icon}
						size={size}
						color={color ?? (variant === "glass" ? "#fff" : tc.foreground)}
					/>
				</Animated.View>
			</Animated.View>
		</Pressable>
	);
}
