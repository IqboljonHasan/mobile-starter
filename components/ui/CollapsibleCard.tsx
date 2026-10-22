import { Ionicons } from "@expo/vector-icons";
import { type ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface CollapsibleCardProps {
	title: string;
	subtitle?: string;
	/** Starts closed unless set — the content is secondary to the page. */
	defaultOpen?: boolean;
	children?: ReactNode;
}

/**
 * A `Card` whose header opens and closes its body, for sections worth having
 * on the page but not worth the scroll every visit.
 */
export function CollapsibleCard({
	title,
	subtitle,
	defaultOpen = false,
	children,
}: CollapsibleCardProps) {
	const { tc } = useTheme();
	const { tf } = useFont();
	const [open, setOpen] = useState(defaultOpen);

	return (
		<View className="rounded-[20px] bg-card overflow-hidden">
			<Pressable
				accessibilityRole="button"
				accessibilityState={{ expanded: open }}
				onPress={() => setOpen((prev) => !prev)}
				className="flex-row items-center gap-3 p-4 active:opacity-70"
			>
				<View className="flex-1">
					<Text className="font-extrabold text-foreground" style={{ fontSize: tf.base }}>
						{title}
					</Text>
					{!!subtitle && (
						<Text className="font-semibold text-muted-foreground mt-0.5" style={{ fontSize: tf.sm }}>
							{subtitle}
						</Text>
					)}
				</View>
				<Ionicons
					name={open ? "chevron-up" : "chevron-down"}
					size={20}
					color={tc.mutedForeground}
				/>
			</Pressable>
			{open && <View className="px-4 pb-4">{children}</View>}
		</View>
	);
}
