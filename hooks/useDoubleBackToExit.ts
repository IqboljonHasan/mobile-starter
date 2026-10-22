import { useFocusEffect } from "expo-router";
import { useCallback, useRef } from "react";
import { BackHandler, Platform, ToastAndroid } from "react-native";

/** How long the second press has to land in — about as long as the toast shows. */
const EXIT_WINDOW_MS = 2000;

/**
 * Android's back button on the root screen leaves the app, which is easy to do
 * by accident on the way back from a sheet. While the calling screen is focused,
 * the first press only warns, and a second one within EXIT_WINDOW_MS exits as
 * it normally would.
 *
 * The listener is held only while focused, so a screen pushed on top keeps its
 * ordinary back. Anything registered later — the number pad, say — still runs
 * first, and sheets are Modals that take the press before it gets here.
 */
export function useDoubleBackToExit(): void {
	const lastPress = useRef(0);

	useFocusEffect(
		useCallback(() => {
			if (Platform.OS !== "android") return;

			const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
				const now = Date.now();
				if (now - lastPress.current < EXIT_WINDOW_MS) {
					// Recent Android only backgrounds the app here rather than
					// closing it, so the next visit has to start with a warning
					// again.
					lastPress.current = 0;
					return false;
				}
				lastPress.current = now;
				ToastAndroid.show("Chiqish uchun yana bir marta bosing", ToastAndroid.SHORT);
				return true;
			});
			return () => subscription.remove();
		}, []),
	);
}
