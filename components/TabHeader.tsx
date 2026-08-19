import { type ReactNode } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useActiveTabShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import "../global.css";

/**
 * Shared top bar for tab screens. Owns the status-bar inset and raises a
 * shadow once the active screen is scrolled off the top.
 */
export default function TabHeader({
	title,
	subtitle,
	headerLeft,
	headerRight,
}: {
	title: string;
	subtitle?: string;
	/** Rendered before the title — e.g. a back button or avatar. */
	headerLeft?: ReactNode;
	/** Rendered at the far right — e.g. an action button. */
	headerRight?: ReactNode;
}) {
	const insets = useSafeAreaInsets();
	const { tf } = useFont();
	const { scrolled } = useActiveTabShadow();

	return (
		<View
			className="bg-card"
			style={{
				paddingTop: insets.top,
				...(scrolled
					? {
							shadowColor: "#000",
							shadowOffset: { width: 0, height: 2 },
							shadowOpacity: 0.08,
							shadowRadius: 6,
							elevation: 8,
							zIndex: 10,
						}
					: null),
			}}
		>
			<View className="min-h-16 flex-row items-center justify-between gap-3 px-4 py-2">
				<View className="flex-row items-center gap-3 flex-1">
					{headerLeft}
					<View className="flex-1">
						<Text
							className="font-semibold text-foreground"
							style={{ fontSize: tf.xxl }}
							numberOfLines={1}
						>
							{title}
						</Text>
						{!!subtitle && (
							<Text
								className="text-muted-foreground"
								style={{ fontSize: tf.sm }}
								numberOfLines={1}
							>
								{subtitle}
							</Text>
						)}
					</View>
				</View>
				{headerRight}
			</View>
		</View>
	);
}
