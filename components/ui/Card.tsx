import { type ReactNode } from "react";
import { Pressable, View, type ViewProps } from "react-native";
import { Text } from "@/components/ui/Text";
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
 * The standard group on a screen: a quiet grey panel with 20px corners and no
 * border or shadow — on the white sheet the tone change alone sets it apart.
 * Anything nested inside it that needs its own surface (an icon tile, a
 * segmented track) uses `bg-background`, which reads as white on the grey.
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
						className="font-extrabold text-foreground"
						style={{ fontSize: tf.base }}
					>
						{title}
					</Text>
				)}
				{!!subtitle && (
					<Text
						className="font-semibold text-muted-foreground mt-0.5"
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

	const containerClass = `rounded-[20px] bg-card overflow-hidden ${
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
