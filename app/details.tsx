import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { Badge, Button, Card, ListRow } from "@/components/ui";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../global.css";

/**
 * A pushed stack route — reachable from the Home tab. Shows how route params
 * arrive and how a screen composes the same UI kit outside the tabs.
 */
export default function DetailsScreen() {
	const router = useRouter();
	const { tc } = useTheme();
	const { tf } = useFont();
	const params = useLocalSearchParams<{ title?: string; from?: string }>();

	return (
		<ScrollView
			className="flex-1 bg-background"
			contentContainerStyle={{ padding: 16, gap: 12 }}
		>
			<Card>
				<View className="flex-row items-center gap-3">
					<View className="w-12 h-12 rounded-2xl items-center justify-center bg-primary-highlight">
						<Ionicons name="document-text-outline" size={24} color={tc.primary} />
					</View>
					<View className="flex-1">
						<Text
							className="font-bold text-foreground"
							style={{ fontSize: tf.xxl }}
						>
							{params.title ?? "Details"}
						</Text>
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							app/details.tsx
						</Text>
					</View>
				</View>
			</Card>

			<Card flush title="Route params">
				<ListRow
					title="title"
					trailing={<Badge label={params.title ?? "—"} tone="primary" />}
				/>
				<ListRow
					title="from"
					divider
					trailing={<Badge label={params.from ?? "—"} />}
				/>
			</Card>

			<Card title="Navigation">
				<Text
					className="text-muted-foreground mb-3"
					style={{ fontSize: tf.base }}
				>
					This screen sits in the root stack above the tabs, so it slides in
					over them and supports the back swipe.
				</Text>
				<View className="gap-2">
					<Button
						label="Push another copy"
						variant="soft"
						fullWidth
						onPress={() => router.push("/details?from=details")}
					/>
					<Button
						label="Back to tabs"
						variant="outline"
						color="secondary"
						fullWidth
						onPress={() => router.dismissTo("/")}
					/>
				</View>
			</Card>
		</ScrollView>
	);
}
