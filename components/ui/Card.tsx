import { type ReactNode } from "react";
import { Pressable, Text, View, type ViewProps } from "react-native";
import { useFont } from "@/hooks/useFont";
import "../../global.css";

export interface CardProps extends Omit<ViewProps, "style"> {
	/** Optional heading rendered above the content. */
	title?: string;
	/** Dimmer line under the title. */
	subtitle?: string;
	/** Rendered at the top-right of the header row — e.g. an action or a badge. */
	headerRight?: ReactNode;
	/** Makes the whole card tappable. */
	onPress?: () => void;
	/** Removes the inner padding — for cards holding a full-bleed list. */
	flush?: boolean;
	children?: ReactNode;
}

/**
 * The standard surface for grouping content on a screen: a rounded `bg-card`
 * panel that reads correctly in both themes without any per-screen styling.
 */
export function Card({
	title,
	subtitle,
	headerRight,
	onPress,
	flush,
	children,
	className,
	...props
}: CardProps) {
	const { tf } = useFont();

	const header = (title || subtitle || headerRight) && (
		<View
			className={`flex-row items-start justify-between gap-3 ${
				flush ? "px-4 pt-4 pb-2" : "mb-3"
			}`}
		>
			<View className="flex-1">
				{!!title && (
					<Text
						className="font-semibold text-foreground"
						style={{ fontSize: tf.lg }}
					>
						{title}
					</Text>
				)}
				{!!subtitle && (
					<Text
						className="text-muted-foreground mt-0.5"
						style={{ fontSize: tf.sm }}
					>
						{subtitle}
					</Text>
				)}
			</View>
			{headerRight}
		</View>
	);

	const body = (
		<>
			{header}
			{children}
		</>
	);

	const containerClass = `rounded-2xl bg-card overflow-hidden ${
		flush ? "" : "p-4"
	} ${className ?? ""}`;

	if (onPress) {
		return (
			<Pressable
				accessibilityRole="button"
				onPress={onPress}
				className={`${containerClass} active:opacity-70`}
			>
				{body}
			</Pressable>
		);
	}

	return (
		<View {...props} className={containerClass}>
			{body}
		</View>
	);
}
