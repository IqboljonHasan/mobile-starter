/**
 * The palette a category or subcategory can be painted with.
 *
 * A category stores a *key* ("blue"), not a hex value, so the same category can
 * be given a step that suits the light surface and a different one that suits
 * the dark surface — the way every other color in this app works.
 *
 * The eight hues and their order are not cosmetic: they were validated as a
 * categorical set (lightness band, chroma floor, colorblind separation between
 * adjacent slots, contrast against the surface) in both modes. Adding a ninth
 * hue, or re-ordering these, invalidates that — categories past the eighth
 * reuse a hue instead, which is safe because a category is also identified by
 * its name and icon.
 */

export type CategoryColor =
	| "blue"
	| "orange"
	| "aqua"
	| "yellow"
	| "magenta"
	| "green"
	| "violet"
	| "red";

/** Fixed assignment order — index N of a new category list gets slot N. */
export const CATEGORY_COLORS: CategoryColor[] = [
	"blue",
	"orange",
	"aqua",
	"yellow",
	"magenta",
	"green",
	"violet",
	"red",
];

/** Spoken name of each hue — a swatch has no text, so screen readers announce this. */
export const CATEGORY_COLOR_LABELS: Record<CategoryColor, string> = {
	blue: "Ko'k",
	orange: "To'q sariq",
	aqua: "Firuza",
	yellow: "Sariq",
	magenta: "Pushti",
	green: "Yashil",
	violet: "Binafsha",
	red: "Qizil",
};

const VALUES: Record<CategoryColor, { light: string; dark: string }> = {
	blue: { light: "#2a78d6", dark: "#3987e5" },
	orange: { light: "#eb6834", dark: "#d95926" },
	aqua: { light: "#1baf7a", dark: "#199e70" },
	yellow: { light: "#eda100", dark: "#c98500" },
	magenta: { light: "#e87ba4", dark: "#d55181" },
	green: { light: "#008300", dark: "#008300" },
	violet: { light: "#4a3aa7", dark: "#9085e9" },
	red: { light: "#e34948", dark: "#e66767" },
};

export function isCategoryColor(value: string): value is CategoryColor {
	return value in VALUES;
}

/** Resolves a stored palette key to the hex for the scheme in effect. */
export function categoryColorValue(color: string, isDark: boolean): string {
	const entry = VALUES[color as CategoryColor] ?? VALUES.blue;
	return isDark ? entry.dark : entry.light;
}

/** The next unused hue, falling back to fixed order once all eight are taken. */
export function nextCategoryColor(used: string[]): CategoryColor {
	const free = CATEGORY_COLORS.find((c) => !used.includes(c));
	return free ?? CATEGORY_COLORS[used.length % CATEGORY_COLORS.length];
}

/** `#rrggbb` + alpha, for the tinted circle behind a category icon. */
export function withAlpha(hex: string, alpha: number): string {
	const a = Math.round(Math.min(Math.max(alpha, 0), 1) * 255)
		.toString(16)
		.padStart(2, "0");
	return `${hex}${a}`;
}
