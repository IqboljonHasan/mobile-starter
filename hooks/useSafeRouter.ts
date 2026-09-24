import { useRouter as useExpoRouter, type ImperativeRouter } from "expo-router";
import { useMemo, useRef } from "react";

/**
 * `useRouter`, guarded against a doubled tap.
 *
 * A fast double-tap on a button that navigates — the two touches landing
 * before React has re-rendered the pressed state, or before the screen
 * transition has even started — fires the handler twice, and expo-router
 * pushes the same screen onto the stack twice. That second push isn't a
 * second thing the user asked for; it's the same one arriving late, and
 * without a fix it shows up as a form (or "Yozuv"/"Qarz" screen) that needs
 * back pressed twice to leave.
 *
 * `push`/`replace`/`back` are ignored for `cooldownMs` after the last one of
 * the three fired; every other method (`setParams`, `canGoBack`, ...) passes
 * through unguarded, since only a stack-mutating call can duplicate a screen.
 * The cooldown is per hook instance (i.e. per screen), so it never blocks a
 * navigation a user genuinely triggers a moment later.
 */
export function useSafeRouter(cooldownMs = 600): ImperativeRouter {
	const router = useExpoRouter();
	const firedAt = useRef(0);

	return useMemo(() => {
		const guard =
			<F extends (...args: never[]) => void>(fn: F) =>
			(...args: Parameters<F>) => {
				const now = Date.now();
				if (now - firedAt.current < cooldownMs) return;
				firedAt.current = now;
				fn(...args);
			};

		return {
			...router,
			push: guard(router.push.bind(router)),
			replace: guard(router.replace.bind(router)),
			back: guard(router.back.bind(router)),
		} as ImperativeRouter;
	}, [router, cooldownMs]);
}
