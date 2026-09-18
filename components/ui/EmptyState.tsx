import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";
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
			<View className="w-16 h-16 rounded-full items-center justify-center bg-muted">
				<Ionicons name={icon} size={28} color={tc.mutedForeground} />
			</View>
			<Text
				className="font-semibold text-foreground mt-4 text-center"
				style={{ fontSize: tf.lg }}
			>
				{title}
			</Text>
			{!!message && (
				<Text
					className="text-muted-foreground mt-1 text-center"
					style={{ fontSize: tf.base }}
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
						startIcon={<Ionicons name="add" size={16} color={tc.primary} />}
					/>
				</View>
			)}
		</View>
	);
}
