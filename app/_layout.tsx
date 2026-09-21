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
import { LedgerProvider } from "@/contexts/LedgerContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
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
				<Stack.Screen name="transaction" options={{ title: "Yozuv" }} />
				<Stack.Screen name="categories" options={{ title: "Kategoriyalar" }} />
				<Stack.Screen name="settings" options={{ title: "Sozlamalar" }} />
			</Stack>
		</View>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView className="flex-1">
			<SafeAreaProvider>
				{/* ThemeProvider sits outermost: FontSizeProvider's consumers read
				    colors, not the other way round, and LedgerProvider's screens read
				    both. */}
				<ThemeProvider>
					<FontSizeProvider>
						<PreferencesProvider>
							<LedgerProvider>
								<AppContent />
							</LedgerProvider>
						</PreferencesProvider>
					</FontSizeProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
