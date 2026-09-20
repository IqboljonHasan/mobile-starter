import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * How much of the screen's bottom edge the on-screen keyboard covers, in dp —
 * 0 while it's closed. Pad a container by this and its content clears the
 * keyboard.
 *
 * This has to be done by hand because the app runs edge-to-edge (the default
 * from Expo SDK 54 / RN 0.81). Once the decor view stops fitting system
 * windows, Android ignores `windowSoftInputMode="adjustResize"` and no longer
 * shrinks the window for the keyboard, so anything anchored to the bottom —
 * a sheet, the lower half of a form — is simply covered.
 *
 * `KeyboardAvoidingView` doesn't rescue it either: it derives the overlap from
 * the event's `screenY`, which is measured against a window that no longer
 * resizes. The event's `height` is still read straight off the IME inset
 * (ReactRootView.checkForKeyboardEvents), which is why that's what this uses.
 *
 * The returned value is measured from the bottom of the *screen*. A container
 * that already sits above the navigation bar — anything inside the root layout,
 * which pads by `insets.bottom` — needs `keyboardInset - insets.bottom`.
 */
export function useKeyboardInset(): number {
	const insets = useSafeAreaInsets();
	const [height, setHeight] = useState(0);

	useEffect(() => {
		// iOS reports the frame before the keyboard moves, so the layout can
		// change in the same beat; Android only ever emits the `did` pair.
		const ios = Platform.OS === "ios";
		const subscriptions = [
			Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) =>
				setHeight(e.endCoordinates.height),
			),
			Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", () =>
				setHeight(0),
			),
		];

		return () => {
			for (const subscription of subscriptions) subscription.remove();
		};
	}, []);

	if (height === 0) return 0;

	// iOS measures the keyboard frame to the bottom of the screen, so the home
	// indicator is already inside it. Android reports the IME inset with the
	// navigation bar taken back out, so add it to get the same reference point.
	return Platform.OS === "android" ? height + insets.bottom : height;
}
