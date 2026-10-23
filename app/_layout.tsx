import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import {
	SafeAreaProvider,
	useSafeAreaInsets,
} from "react-native-safe-area-context";
import ScreenHeader from "@/components/ScreenHeader";
import SplashOverlay from "@/components/SplashOverlay";
import { FontSizeProvider } from "@/contexts/FontSizeContext";
import { LedgerProvider, useLedger } from "@/contexts/LedgerContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { TelegramBackupProvider } from "@/contexts/TelegramBackupContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { useDebtReminders } from "@/hooks/useDebtReminders";
import { useTheme } from "@/hooks/useTheme";
import "../global.css";

// The native splash is held until SplashOverlay — the same logo, drawn in
// React — is on screen to take over from it. Called at module scope because it
// has to land before the native splash hides on its own.
SplashScreen.preventAutoHideAsync();

/** Longest the logo is held for, should reading storage never come back. */
const SPLASH_TIMEOUT_MS = 8000;

function AppContent() {
	const { isDark, tc } = useTheme();
	const insets = useSafeAreaInsets();
	const { ready } = useLedger();
	useDebtReminders();

	// Paints the window behind the navigation bar, so an overscroll or a
	// translucent system bar doesn't flash white in dark mode.
	useEffect(() => {
		SystemUI.setBackgroundColorAsync(tc.background);
	}, [tc.background]);

	// The logo stays up while the stored ledger is read, so the first thing
	// after it is the finished home screen rather than a spinner.
	const [timedOut, setTimedOut] = useState(false);
	useEffect(() => {
		if (ready) return;
		const timer = setTimeout(() => setTimedOut(true), SPLASH_TIMEOUT_MS);
		return () => clearTimeout(timer);
	}, [ready]);

	return (
		<>
			{/* The `dark` / `light` class is what NativeWind's variants resolve
			    against; the top inset is handled by ScreenHeader (and by the home
			    screen, which draws its own sky under the status bar), so only the
			    remaining edges are padded here. */}
			<View
				className={`flex-1 bg-background ${isDark ? "dark" : "light"}`}
				style={{
					paddingBottom: insets.bottom,
					paddingLeft: insets.left,
					paddingRight: insets.right,
				}}
			>
				{/* Every screen is dark under the status bar — the home screen's
				    blue sky, or the navy strip above a sheet — so its icons are light
				    in both themes. */}
				<StatusBar style="light" />
				<Stack
					screenOptions={{
						// Screens rise into place like a sheet being laid over the one
						// below, which is what the rounded header draws them as.
						animation: "fade_from_bottom",
						gestureEnabled: true,
						gestureDirection: "horizontal",
						fullScreenGestureEnabled: true,
						contentStyle: { backgroundColor: tc.background },
						header: (props) => <ScreenHeader {...props} />,
					}}
				>
					<Stack.Screen name="index" options={{ headerShown: false, animation: "none" }} />
					<Stack.Screen name="entries" options={{ title: "Kirim va chiqimlar" }} />
					<Stack.Screen name="debts" options={{ title: "Qarzlar" }} />
					<Stack.Screen name="transaction" options={{ title: "Yozuv" }} />
					<Stack.Screen name="categories" options={{ title: "Kategoriyalar" }} />
					<Stack.Screen name="wallets" options={{ title: "Hamyonlar" }} />
					<Stack.Screen name="stats" options={{ title: "Statistika" }} />
					<Stack.Screen name="debt" options={{ title: "Qarz" }} />
					<Stack.Screen name="contacts" options={{ title: "Kontaktlar" }} />
					<Stack.Screen name="settings" options={{ title: "Sozlamalar" }} />
					<Stack.Screen name="telegram" options={{ title: "Telegram zaxira" }} />
				</Stack>
			</View>
			{/* Outside the padded view, so it covers the whole window exactly as the
			    native splash it takes over from does. */}
			<SplashOverlay done={ready || timedOut} />
		</>
	);
}

export default function RootLayout() {
	return (
		<GestureHandlerRootView className="flex-1">
			<SafeAreaProvider>
				{/* ThemeProvider sits outermost: FontSizeProvider's consumers read
				    colors, not the other way round, and LedgerProvider's screens read
				    both. TelegramBackupProvider sends the ledger, so it sits inside
				    LedgerProvider. */}
				<ThemeProvider>
					<FontSizeProvider>
						<PreferencesProvider>
							<LedgerProvider>
								<TelegramBackupProvider>
									<AppContent />
								</TelegramBackupProvider>
							</LedgerProvider>
						</PreferencesProvider>
					</FontSizeProvider>
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
