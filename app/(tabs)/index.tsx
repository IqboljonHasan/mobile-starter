import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import TabHeader from "@/components/TabHeader";
import { Badge, Button, Card, ListRow } from "@/components/ui";
import { useTabNavigation } from "@/contexts/TabNavigationContext";
import { useTabScrollShadow } from "@/contexts/TabScrollShadowContext";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const RECENT = [
	{
		id: "1",
		title: "Routing",
		subtitle: "expo-router, file-based",
		icon: "git-branch-outline" as const,
	},
	{
		id: "2",
		title: "Theming",
		subtitle: "Semantic tokens, light & dark",
		icon: "color-palette-outline" as const,
	},
	{
		id: "3",
		title: "Text scale",
		subtitle: "One setting, whole app",
		icon: "text-outline" as const,
	},
];

export default function HomeScreen() {
	const router = useRouter();
	const { goToTab } = useTabNavigation();
	const { tc } = useTheme();
	const { tf } = useFont();
	const shadow = useTabScrollShadow("home");

	return (
		<View className="flex-1 bg-background">
			<TabHeader title="Home" subtitle="Starter template" />
			<ScrollView
				{...shadow}
				contentContainerStyle={{ padding: 16, gap: 12 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Hero */}
				<Card>
					<View className="flex-row items-start justify-between gap-3">
						<View className="flex-1">
							<Text
								className="font-bold text-foreground"
								style={{ fontSize: tf.xxxl }}
							>
								Mobile Starter
							</Text>
							<Text
								className="text-muted-foreground mt-1"
								style={{ fontSize: tf.base }}
							>
								Everything below is themed, scales with the text-size setting,
								and works in light and dark.
							</Text>
						</View>
						<Badge label="v0.1" tone="primary" />
					</View>
					<View className="flex-row gap-2 mt-4">
						<Button
							label="Open details"
							endIcon={<Ionicons name="arrow-forward" size={16} color="#fff" />}
							onPress={() => router.push("/details")}
						/>
						{/* A sibling tab lives in the pager, not the router — see
						    TabNavigationContext. */}
						<Button
							label="Components"
							variant="soft"
							color="secondary"
							onPress={() => goToTab("components")}
						/>
					</View>
				</Card>

				{/* Stat row */}
				<View className="flex-row gap-3">
					<Card className="flex-1">
						<Ionicons name="cube-outline" size={20} color={tc.primary} />
						<Text
							className="font-bold text-foreground mt-2"
							style={{ fontSize: tf.xxl }}
						>
							10
						</Text>
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							UI components
						</Text>
					</Card>
					<Card className="flex-1">
						<Ionicons name="layers-outline" size={20} color={tc.success} />
						<Text
							className="font-bold text-foreground mt-2"
							style={{ fontSize: tf.xxl }}
						>
							3
						</Text>
						<Text
							className="text-muted-foreground"
							style={{ fontSize: tf.sm }}
						>
							Tabs
						</Text>
					</Card>
				</View>

				{/* Grouped list */}
				<Card flush title="What's included">
					{RECENT.map((item, i) => (
						<ListRow
							key={item.id}
							title={item.title}
							subtitle={item.subtitle}
							icon={item.icon}
							divider={i > 0}
							onPress={() =>
								router.push(`/details?title=${item.title}&from=home`)
							}
						/>
					))}
				</Card>

				<Text
					className="text-muted-foreground text-center px-6 pt-2"
					style={{ fontSize: tf.xs }}
				>
					Swipe left and right to move between tabs.
				</Text>
			</ScrollView>
		</View>
	);
}
