import { useEffect, useState, type ReactNode } from "react";
import {
	Animated,
	type DimensionValue,
	Dimensions,
	Keyboard,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/hooks/useTheme";
import "../../global.css";

const SCREEN_H = Dimensions.get("window").height;
const DURATION = 250;

export interface BottomSheetProps {
	visible: boolean;
	onClose: () => void;
	children: ReactNode;
	maxHeight?: DimensionValue;
	showHandle?: boolean;
	backdrop?: "dim" | "faint";
}

/**
 * Uses a real `<Modal>` rather than an absolutely-positioned in-app overlay.
 *
 * Sheets get opened from deep inside component trees — a tab screen nested in a
 * `PagerView`, a `Select` inside a form's `ScrollView` — and RN positions
 * `position: absolute` against the parent view, not the screen. An in-app
 * overlay is therefore clipped to whatever container renders it: it cannot
 * cover the bottom tab bar (a sibling above the pager), it inherits the root
 * layout's safe-area padding as a gap, and inside a `ScrollView` it is
 * positioned against the scrolling content. A Modal gets its own window, so it
 * covers the screen no matter where it is rendered from.
 */
export default function BottomSheet({
	visible,
	onClose,
	children,
	maxHeight,
	showHandle = true,
	backdrop = "dim",
}: BottomSheetProps) {
	// The sheet owns its bottom spacing, so its background reaches the true
	// bottom edge of the screen (the window is translucent over the navigation
	// bar) while content still clears the gesture bar. Sheet content must not
	// add its own bottom padding on top of this, or the two stack into a gap.
	const insets = useSafeAreaInsets();
	const bottomPad = Math.max(insets.bottom, 16);
	const { tc } = useTheme();

	// Inline rgba() rather than a `bg-black/50`-style className: NativeWind 5
	// preview + Tailwind v4's oklch()-based default palette can silently fail to
	// compile opacity modifiers on core colors like black/white (custom hex theme
	// tokens such as `bg-danger/15` are unaffected and work fine), which left the
	// backdrop fully transparent.
	const backdropColor =
		backdrop === "dim" ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.3)";

	// Backdrop fades, sheet slides — driven here rather than by Modal's
	// `animationType`, which can only do one or the other for the whole window.
	const [overlayOpacity] = useState(() => new Animated.Value(0));
	const [translateY] = useState(() => new Animated.Value(SCREEN_H));

	// Keeps the Modal mounted through the closing animation.
	const [rendered, setRendered] = useState(visible);

	const [prevVisible, setPrevVisible] = useState(visible);
	if (visible !== prevVisible) {
		setPrevVisible(visible);
		if (visible) {
			overlayOpacity.setValue(0);
			translateY.setValue(SCREEN_H);
			setRendered(true);
		}
	}

	useEffect(() => {
		if (!visible && rendered) {
			// Take the keyboard down with the sheet: this runs while `rendered` is
			// still true, so a focused input is still mounted to be blurred.
			Keyboard.dismiss();
			Animated.parallel([
				Animated.timing(overlayOpacity, {
					toValue: 0,
					duration: DURATION,
					useNativeDriver: true,
				}),
				Animated.timing(translateY, {
					toValue: SCREEN_H,
					duration: DURATION,
					useNativeDriver: true,
				}),
			]).start(({ finished }) => {
				if (finished) setRendered(false);
			});
		}
	}, [visible, rendered, overlayOpacity, translateY]);

	// Fade in / slide in once the Modal's window is actually up.
	useEffect(() => {
		if (!rendered) return;
		overlayOpacity.setValue(0);
		translateY.setValue(SCREEN_H);
		Animated.parallel([
			Animated.timing(overlayOpacity, {
				toValue: 1,
				duration: DURATION,
				useNativeDriver: true,
			}),
			Animated.timing(translateY, {
				toValue: 0,
				duration: DURATION,
				useNativeDriver: true,
			}),
		]).start();
	}, [rendered, overlayOpacity, translateY]);

	return (
		<Modal
			visible={rendered}
			transparent
			// Animated by hand above, so the window itself must not animate.
			animationType="none"
			// Without these the window stops at the system bars on Android and the
			// backdrop leaves undimmed strips top and bottom.
			statusBarTranslucent
			navigationBarTranslucent
			onRequestClose={() => {
				Keyboard.dismiss();
				onClose();
			}}
		>
			<KeyboardAvoidingView
				style={{ flex: 1 }}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<View style={{ flex: 1 }}>
					{/* Decorative dim layer — non-interactive, so it never competes with
					    the tap-outside-to-close area below. */}
					<Animated.View
						pointerEvents="none"
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							right: 0,
							bottom: 0,
							backgroundColor: backdropColor,
							opacity: overlayOpacity,
						}}
					/>
					<View className="flex-1 justify-end">
						<Pressable
							className="flex-1"
							accessibilityLabel="Close"
							onPress={onClose}
						/>
						{/* The transform lives on the card itself rather than a wrapper:
						    a percentage `maxHeight` only resolves against a parent with a
						    definite height, and an extra wrapper (content-sized, so
						    indefinite) silently drops the constraint. This keeps the card
						    a direct child of the flex-1 container above. */}
						<Animated.View
							className="rounded-t-3xl"
							style={{
								backgroundColor: tc.card,
								transform: [{ translateY }],
								paddingBottom: bottomPad,
								...(maxHeight ? { maxHeight } : {}),
							}}
						>
							{showHandle && (
								<View className="items-center pt-3 pb-1">
									<View className="w-10 h-1 rounded-full bg-disabled" />
								</View>
							)}
							{children}
						</Animated.View>
					</View>
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}
