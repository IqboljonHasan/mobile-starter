import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Appearance, Image, StyleSheet } from "react-native";

/*
 * Keep these in step with the `expo-splash-screen` plugin in app.json: this
 * is the same screen drawn again in React, so the two must match to the pixel
 * for the hand-over between them to be invisible.
 */
const BACKGROUND = { light: "#FFFFFF", dark: "#0F1722" } as const;
const LOGO = {
	light: require("../assets/images/splash-logo.png"),
	dark: require("../assets/images/splash-logo-dark.png"),
} as const;
/** `imageWidth` in app.json, in dp. */
const LOGO_WIDTH = 180;
/** The rendered PNGs are 1200×360. */
const LOGO_HEIGHT = (LOGO_WIDTH * 360) / 1200;

/** How long the native splash waits for the logo here before it goes anyway. */
const HANDOFF_FALLBACK_MS = 1000;

/**
 * The splash screen, for as long as the app is loading.
 *
 * The native splash only covers the cold start up to the first React frame:
 * it isn't shown at all when the JS reloads, and it has to come down before
 * anything below it can draw. This takes over from it — the native one hides
 * once this has its logo on screen, so the swap can't be seen — and stays up
 * until `done`, then fades away onto the finished home screen.
 *
 * The colour scheme is fixed at the first frame, on purpose: the native
 * splash follows the system, and the app's own theme setting is read a moment
 * later. Following that here would flip the backdrop mid-load.
 */
export default function SplashOverlay({ done }: { done: boolean }) {
	const [scheme] = useState<"light" | "dark">(() =>
		Appearance.getColorScheme() === "dark" ? "dark" : "light",
	);
	const [opacity] = useState(() => new Animated.Value(1));
	const [gone, setGone] = useState(false);
	const handedOff = useRef(false);

	const handOff = useCallback(() => {
		if (handedOff.current) return;
		handedOff.current = true;
		SplashScreen.hideAsync();
	}, []);

	// Should the logo never report itself loaded, the native splash still has
	// to come down — the copy underneath is already the right colour.
	useEffect(() => {
		const timer = setTimeout(handOff, HANDOFF_FALLBACK_MS);
		return () => clearTimeout(timer);
	}, [handOff]);

	useEffect(() => {
		if (!done) return;
		handOff();
		Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(
			({ finished }) => finished && setGone(true),
		);
	}, [done, opacity, handOff]);

	if (gone) return null;

	return (
		<Animated.View
			// Taps fall through while it fades, so the first one isn't lost.
			pointerEvents={done ? "none" : "auto"}
			accessibilityLabel="Taqsim yuklanmoqda"
			style={[
				StyleSheet.absoluteFill,
				{
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: BACKGROUND[scheme],
					opacity,
				},
			]}
		>
			{/* Dark icons on the white backdrop; the app's own light ones return
			    with the root's StatusBar once this unmounts. */}
			<StatusBar style={scheme === "dark" ? "light" : "dark"} />
			<Image
				source={LOGO[scheme]}
				onLoad={handOff}
				resizeMode="contain"
				style={{ width: LOGO_WIDTH, height: LOGO_HEIGHT }}
			/>
		</Animated.View>
	);
}
