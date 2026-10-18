import {
	useNavigation,
	useRouter as useExpoRouter,
	type ImperativeRouter,
} from "expo-router";
import { useMemo } from "react";

/**
 * When the last `push`/`replace`/`back` went out, from anywhere in the app.
 * Module-level on purpose: there is one stack, and two different buttons can
 * duplicate a screen as easily as one button tapped twice.
 */
let firedAt = 0;

/**
 * `useRouter`, guarded against repeated taps.
 *
 * A tap that navigates and then a second one before the new screen is up —
 * a fast double-tap, or a deliberate second tap because the first seemed to do
 * nothing on a slow open — would push the same screen onto the stack twice.
 * That second push isn't a second thing the user asked for; it's the same one
 * arriving late, and it shows up as a form (or "Yozuv"/"Qarz" screen) that
 * needs back pressed twice to leave.
 *
 * Two checks, because neither covers it alone:
 *
 * - **Focus.** Once a navigation from this screen has landed, it is no longer
 *   the focused screen — even while the transition is still animating and its
 *   buttons still take touches. Anything it asks for after that is ignored, for
 *   however long the next screen takes to appear.
 * - **Cooldown.** expo-router queues a navigation and dispatches it a render
 *   later, so two taps in the same moment both still see this screen focused.
 *   Any stack call within `cooldownMs` of the last one is dropped.
 *
 * Every other method (`setParams`, `canGoBack`, ...) passes through unguarded,
 * since only a stack-mutating call can duplicate a screen.
 */
export function useSafeRouter(cooldownMs = 600): ImperativeRouter {
	const router = useExpoRouter();
	const navigation = useNavigation();

	return useMemo(() => {
		const guard =
			<F extends (...args: never[]) => void>(fn: F) =>
			(...args: Parameters<F>) => {
				if (!navigation.isFocused()) return;
				const now = Date.now();
				if (now - firedAt < cooldownMs) return;
				firedAt = now;
				fn(...args);
			};

		return {
			...router,
			push: guard(router.push.bind(router)),
			replace: guard(router.replace.bind(router)),
			back: guard(router.back.bind(router)),
		} as ImperativeRouter;
	}, [router, navigation, cooldownMs]);
}
