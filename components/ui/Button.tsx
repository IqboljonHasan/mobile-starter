import { type ReactNode } from "react";
import {
	ActivityIndicator,
	type GestureResponderEvent,
	Pressable,
	type PressableProps,
	Text,
	type TextStyle,
	type ViewStyle,
} from "react-native";
import Animated, {
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from "react-native-reanimated";
import { useFont } from "@/hooks/useFont";
import { useGuardedPress } from "@/hooks/useGuardedPress";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant = "solid" | "outline" | "soft" | "text";
export type ButtonColor = "primary" | "secondary" | "success" | "danger";
export type ButtonSize = "sm" | "md" | "lg";
export type ButtonShape = "rounded" | "pill";

export interface ButtonProps extends Omit<PressableProps, "style"> {
	label?: string;
	loading?: boolean;
	variant?: ButtonVariant;
	color?: ButtonColor;
	size?: ButtonSize;
	/** "rounded" (default, rounded-xl corners) or "pill" (fully rounded — FABs, chips). */
	shape?: ButtonShape;
	/** Stretches the button to fill its parent's cross axis. */
	fullWidth?: boolean;
	/** Rendered before the label. Replaced by the spinner while `loading`. */
	startIcon?: ReactNode;
	/** Rendered after the label. */
	endIcon?: ReactNode;
	children?: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
	sm: "px-4 py-2",
	md: "px-5 py-3.5",
	lg: "px-6 py-4.5",
};

const FONT_KEYS: Record<ButtonSize, "sm" | "base" | "lg"> = {
	sm: "sm",
	md: "base",
	lg: "lg",
};

const PALETTE: Record<
	ButtonColor,
	{
		bgClass: string;
		fgClass: string;
		softClass: string;
		borderClass: string;
		tintClass: string;
	}
> = {
	primary: {
		bgClass: "bg-primary",
		fgClass: "text-primary-fg",
		softClass: "bg-primary-highlight",
		borderClass: "border-primary",
		tintClass: "text-primary",
	},
	secondary: {
		bgClass: "bg-muted",
		fgClass: "text-foreground",
		softClass: "bg-muted",
		borderClass: "border-border",
		tintClass: "text-foreground",
	},
	success: {
		bgClass: "bg-success",
		fgClass: "text-success-fg",
		softClass: "bg-success/15",
		borderClass: "border-success",
		tintClass: "text-success",
	},
	danger: {
		bgClass: "bg-danger",
		fgClass: "text-danger-fg",
		softClass: "bg-danger/15",
		borderClass: "border-danger",
		tintClass: "text-danger",
	},
};

export function Button({
	label,
	loading,
	disabled,
	variant = "solid",
	color = "primary",
	size = "md",
	shape = "rounded",
	fullWidth,
	startIcon,
	endIcon,
	children,
	onPress,
	onPressIn,
	onPressOut,
	...props
}: ButtonProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const isDisabled = loading || disabled;

	// A doubled tap — two touches landing before this component has re-rendered
	// as `disabled` — must not run `onPress` twice: a FAB that navigates would
	// push the same screen twice, and a save button would write the same
	// transaction twice. See the hook for why this can't just be `disabled` state.
	const handlePress = useGuardedPress(onPress);

	// Press feedback runs on the UI thread, so it stays smooth even while the
	// press handler does work on the JS thread.
	const scale = useSharedValue(1);
	const pressAnimatedStyle = useAnimatedStyle(() => ({
		transform: [{ scale: scale.get() }],
	}));

	const handlePressIn = (e: GestureResponderEvent) => {
		scale.set(withTiming(0.96, { duration: 100 }));
		onPressIn?.(e);
	};
	const handlePressOut = (e: GestureResponderEvent) => {
		scale.set(withTiming(1, { duration: 100 }));
		onPressOut?.(e);
	};

	const palette = PALETTE[color];
	const tint = {
		primary: tc.primary,
		secondary: tc.foreground,
		success: tc.success,
		danger: tc.danger,
	}[color];
	const solidText: string = color === "secondary" ? tc.foreground : "#fff";

	let containerClassName = `flex-row items-center justify-center gap-2 ${
		shape === "pill" ? "rounded-full" : "rounded-xl"
	} ${SIZE_CLASSES[size]} ${fullWidth ? "self-stretch" : ""}`;
	let textClassName = "font-semibold";
	const containerStyle: ViewStyle = { opacity: isDisabled ? 0.6 : 1 };
	const textStyle: TextStyle = { fontSize: tf[FONT_KEYS[size]] };
	let spinnerColor = tint;

	if (variant === "solid") {
		containerClassName += ` ${palette.bgClass}`;
		textClassName += ` ${palette.fgClass}`;
		spinnerColor = solidText;
	} else if (variant === "outline") {
		containerClassName += ` border ${palette.borderClass}`;
		textClassName += ` ${palette.tintClass}`;
	} else if (variant === "soft") {
		containerClassName += ` ${palette.softClass}`;
		textClassName += ` ${palette.tintClass}`;
	} else {
		textClassName += ` ${palette.tintClass}`;
	}

	return (
		<AnimatedPressable
			accessibilityRole="button"
			accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
			{...props}
			disabled={isDisabled}
			onPress={handlePress}
			onPressIn={handlePressIn}
			onPressOut={handlePressOut}
			className={containerClassName}
			style={[containerStyle, pressAnimatedStyle]}
		>
			{loading ? (
				<ActivityIndicator color={spinnerColor} size="small" />
			) : (
				startIcon
			)}
			{!!label && (
				<Text className={textClassName} style={textStyle}>
					{label}
				</Text>
			)}
			{children}
			{!loading && endIcon}
		</AnimatedPressable>
	);
}
