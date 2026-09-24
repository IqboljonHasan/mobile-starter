import { useRef } from "react";

/**
 * Wraps a press handler so a doubled tap can only ever run it once.
 *
 * Two touches landing close together — a genuine double-tap, or the same
 * touch reported twice by the gesture responder — fire `onPress` twice before
 * whatever it does (navigate, save, delete) has had any chance to change
 * something that would naturally stop a second run. Debouncing the handler
 * itself, rather than trusting each caller to guard its own action, is what
 * makes every button and row safe by construction instead of by remembering
 * to add a check every time one is written.
 *
 * A plain `useRef` timestamp rather than `disabled` state: the check has to
 * run synchronously inside the handler itself, before React has any chance to
 * re-render and propagate a `disabled` prop back down to the native view —
 * two calls arriving in the same tick must still see the same, already-updated
 * ref.
 */
export function useGuardedPress<A extends unknown[]>(
	handler: ((...args: A) => void) | null | undefined,
	cooldownMs = 600,
): (...args: A) => void {
	const firedAt = useRef(0);

	return (...args: A) => {
		if (!handler) return;
		const now = Date.now();
		if (now - firedAt.current < cooldownMs) return;
		firedAt.current = now;
		handler(...args);
	};
}
