import type { NativeStackHeaderProps } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconButton } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { useFont } from "@/hooks/useFont";
import { useTheme } from "@/hooks/useTheme";
import { RADIUS } from "@/lib/theme";

/**
 * The top of every pushed screen: a navy strip under the status bar, and the
 * white sheet the screen lives on starting below it with rounded corners — so
 * each screen reads as a card laid over a dark backdrop.
 *
 * It is the stack's `header`, so a screen keeps declaring its title and
 * `headerRight` through `<Stack.Screen options>` exactly as before and gets
 * this look without knowing about it. The sheet's body is the screen itself,
 * whose background is the same white.
 */
export default function ScreenHeader({ options, navigation, back, route }: NativeStackHeaderProps) {
	const insets = useSafeAreaInsets();
	const { tc } = useTheme();
	const { tf } = useFont();

	const title = typeof options.title === "string" ? options.title : route.name;
	const right = options.headerRight?.({ tintColor: tc.foreground, canGoBack: !!back });

	return (
		<View style={{ backgroundColor: tc.backdrop, paddingTop: insets.top + 8 }}>
			{/* Light icons on the navy strip. The root already asks for them, but
			    mounting one per screen re-sends it on every push, so nothing native
			    that resets the bar can leave dark icons stuck here. */}
			<StatusBar style="light" />
			<View
				style={{
					backgroundColor: tc.background,
					borderTopLeftRadius: RADIUS.sheet,
					borderTopRightRadius: RADIUS.sheet,
					paddingTop: 6,
					paddingHorizontal: 18,
					paddingBottom: 8,
				}}
			>
				<View className="flex-row items-center" style={{ gap: 10, minHeight: 44 }}>
					{back && (
						<IconButton
							variant="ghost"
							icon="arrow-back"
							accessibilityLabel="Orqaga"
							onPress={navigation.goBack}
						/>
					)}
					<Text
						accessibilityRole="header"
						className="flex-1 font-extrabold text-foreground"
						style={{ fontSize: tf.xxl, letterSpacing: -0.2 }}
						numberOfLines={1}
					>
						{title}
					</Text>
					{right}
				</View>
			</View>
		</View>
	);
}
