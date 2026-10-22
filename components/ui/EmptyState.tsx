import { Ionicons } from "@expo/vector-icons";
import { View } from "react-native";
import { Text } from "@/components/ui/Text";
import { Button } from "@/components/ui/Button";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

export interface EmptyStateProps {
	icon: keyof typeof Ionicons.glyphMap;
	title: string;
	message?: string;
	actionLabel?: string;
	onAction?: () => void;
}

/** The "nothing here yet" panel — a list should never be a blank screen. */
export function EmptyState({
	icon,
	title,
	message,
	actionLabel,
	onAction,
}: EmptyStateProps) {
	const { tc } = useTheme();
	const { tf } = useFont();

	return (
		<View className="items-center px-8 py-12">
			<View
				className="items-center justify-center bg-card"
				style={{ width: 56, height: 56, borderRadius: 18 }}
			>
				<Ionicons name={icon} size={26} color={tc.mutedForeground} />
			</View>
			<Text
				className="font-bold text-foreground mt-4 text-center"
				style={{ fontSize: tf.base }}
			>
				{title}
			</Text>
			{!!message && (
				<Text
					className="font-semibold text-muted-foreground mt-1.5 text-center"
					style={{ fontSize: tf.sm, lineHeight: Math.round(tf.sm * 1.4) }}
				>
					{message}
				</Text>
			)}
			{!!actionLabel && !!onAction && (
				<View className="mt-4">
					<Button
						label={actionLabel}
						variant="soft"
						size="sm"
						shape="pill"
						onPress={onAction}
						startIcon={<Ionicons name="add" size={16} color={tc.foreground} />}
					/>
				</View>
			)}
		</View>
	);
}
