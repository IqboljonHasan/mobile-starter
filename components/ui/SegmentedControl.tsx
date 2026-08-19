import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export type SegmentItem<T extends string = string> = {
	key: T;
	label: string;
	icon?: keyof typeof Ionicons.glyphMap;
};

/**
 * Anything that exposes Animated `.interpolate()` — e.g. `Animated.Value`,
 * `Animated.AnimatedAddition` (returned by `Animated.add`), or an interpolation.
 */
type InterpolatableAnim = Pick<Animated.Value, "interpolate">;

export interface SegmentedControlProps<T extends string = string> {
	items: SegmentItem<T>[];
	value: T;
	onChange: (key: T) => void;
	className?: string;
	/**
	 * When provided, the highlight tracks this animated value (a page index as a
	 * float) instead of springing to the selected item — for wiring the control
	 * to a swipeable pager so it follows the drag.
	 */
	scrollAnim?: InterpolatableAnim;
}

export function SegmentedControl<T extends string = string>({
	items,
	value,
	onChange,
	className,
	scrollAnim,
}: SegmentedControlProps<T>) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [pillAnim] = useState(() => new Animated.Value(0));
	const [containerWidth, setContainerWidth] = useState(0);
	const hasIcons = items.some((i) => i.icon);

	// Spring fallback — only used when no external scrollAnim drives the pill.
	useEffect(() => {
		if (scrollAnim) return;
		const idx = items.findIndex((i) => i.key === value);
		Animated.spring(pillAnim, {
			toValue: idx < 0 ? 0 : idx,
			useNativeDriver: true,
			bounciness: 0,
			speed: 20,
		}).start();
	}, [value, items, pillAnim, scrollAnim]);

	return (
		<View
			className={`flex-row bg-card rounded-full overflow-hidden p-1 ${className ?? ""}`}
			onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
		>
			{containerWidth > 0 &&
				(() => {
					const pillW = (containerWidth - 8) / items.length;
					const activeAnim = scrollAnim ?? pillAnim;
					const translateX = activeAnim.interpolate({
						inputRange: items.map((_, i) => i),
						outputRange: items.map((_, i) => i * pillW),
						extrapolate: "clamp",
					});
					return (
						<Animated.View
							style={{
								position: "absolute",
								left: 4,
								top: 4,
								bottom: 4,
								width: pillW,
								borderRadius: 9999,
								backgroundColor: tc.primaryHighlight,
								transform: [{ translateX }],
							}}
						/>
					);
				})()}
			{items.map((item) => {
				const active = item.key === value;
				return (
					<Pressable
						key={item.key}
						accessibilityRole="button"
						accessibilityState={{ selected: active }}
						onPress={() => onChange(item.key)}
						className={`flex-1 flex-row items-center justify-center rounded-full gap-1.5 ${
							hasIcons ? "py-2" : "py-2.5"
						}`}
					>
						{item.icon && (
							<Ionicons
								name={item.icon}
								size={16}
								color={active ? tc.primary : tc.mutedForeground}
							/>
						)}
						<Text
							className={`font-semibold ${
								active ? "text-primary" : "text-muted-foreground"
							}`}
							style={{ fontSize: tf.base }}
							numberOfLines={1}
						>
							{item.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}
