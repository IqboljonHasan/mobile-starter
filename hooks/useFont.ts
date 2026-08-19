import { useMemo } from "react";
import { useFontSize } from "@/contexts/FontSizeContext";

/** Base pixel sizes matching Tailwind's text-* scale */
const BASE = {
	xs: 11,
	sm: 13,
	base: 15,
	lg: 17,
	xl: 19,
	xxl: 22,
	xxxl: 26,
} as const;

type FontKey = keyof typeof BASE;

/**
 * Returns `tf` — font sizes scaled by the user's text-size setting.
 * Use it anywhere text is rendered, so the Settings slider actually reaches
 * the whole app:
 *
 *   const { tf } = useFont();
 *   <Text style={{ fontSize: tf.base }}>Hello</Text>
 *
 * Prefer this over Tailwind's `text-base` / `text-lg` classes, which are fixed.
 */
export function useFont() {
	const { multiplier } = useFontSize();

	const tf = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(BASE).map(([k, v]) => [k, Math.round(v * multiplier)]),
			) as Record<FontKey, number>,
		[multiplier],
	);

	return { tf };
}
