import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useTheme } from "@/hooks/useTheme";
import "../global.css";

function AppContent() {
	const { isDark, tc } = useTheme();
	const insets = useSafeAreaInsets();

	// Paints the window behind the navigation bar, so an overscroll or a
	// translucent system bar doesn't flash white in dark mode.
	useEffect(() => {
		SystemUI.setBackgroundColorAsync(tc.card);
	}, [tc.card]);

	return (
		// The `dark` / `light` class is what NativeWind's variants resolve
		// against; the top inset is handled per-screen by TabHeader, so only the
		// remaining edges are padded here.
		<View
			className={`flex-1 bg-background ${isDark ? "dark" : "light"}`}
			style={{
				paddingBottom: insets.bottom,
				paddingLeft: insets.left,
				paddingRight: insets.right,
			}}
		>
			<StatusBar style={isDark ? "light" : "dark"} />
			<Stack
				screenOptions={{
					animation: "simple_push",
					gestureEnabled: true,
					gestureDirection: "horizontal",
					fullScreenGestureEnabled: true,
					contentStyle: { backgroundColor: tc.background },
					headerStyle: { backgroundColor: tc.card },
					headerTintColor: tc.foreground,
					headerTitleStyle: { fontWeight: "bold" },
					headerShadowVisible: false,
				}}
			>
				<Stack.Screen
					name="(tabs)"
					options={{ headerShown: false, animation: "none" }}
				/>
				<Stack.Screen name="details" options={{ title: "Details" }} />
				{/* Title is set from inside the screen — it depends on whether an
				    existing schedule is being edited. */}
				<Stack.Screen name="schedule" options={{ title: "New schedule" }} />
			</Stack>
		</View>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView className="flex-1">
			<SafeAreaProvider>
				{/* ThemeProvider sits outermost of the two: FontSizeProvider's
				    consumers read colors, not the other way round. */}
				<ThemeProvider>
					<FontSizeProvider>
						<AppContent />
					</FontSizeProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
