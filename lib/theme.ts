/**
 * Runtime color values that mirror the semantic tokens from global.css.
 * Use these ONLY for props that don't support className (icon color,
 * placeholderTextColor, shadowColor, native navigator options, …).
 * For anything that supports className, use the semantic classes directly:
 *   bg-background, bg-card, bg-muted, bg-input, bg-primary, bg-primary-highlight,
 *   bg-brand, bg-success-soft, bg-danger-soft, text-foreground,
 *   text-secondary-foreground, text-muted-foreground, border-border, etc.
 *
 * Keep every value here in sync with its counterpart in global.css.
 *
 * The design system in one paragraph: every screen is a white sheet with
 * rounded top corners laid over the brand blue. On the sheet, related things
 * are grouped on quiet grey (`card`) panels with no borders; ink (`primary`)
 * marks what is picked or pressed; green and red are kept for money coming in
 * and going out; and colour otherwise belongs to the wallets. The type is
 * Manrope, set heavy — 700–800 for figures and titles.
 */

export type ThemeColors = {
	background: string;
	card: string;
	muted: string;
	foreground: string;
	secondaryForeground: string;
	mutedForeground: string;
	placeholder: string;
	border: string;
	input: string;
	disabled: string;
	primary: string;
	/** Text and icons on a solid `primary` fill. */
	primaryFg: string;
	primaryHighlight: string;
	/** The blue behind every sheet and on the home screen. */
	brand: string;
	brandFg: string;
	/** The ring around a focused field. */
	focus: string;
	success: string;
	successSoft: string;
	danger: string;
	dangerSoft: string;
	warning: string;
	warningSoft: string;
};

const light: ThemeColors = {
	background: "#ffffff",
	card: "#f4f6f9",
	muted: "#edf0f4",
	foreground: "#0b1b2e",
	secondaryForeground: "#3a4b61",
	mutedForeground: "#5b6b80",
	placeholder: "#8a97a8",
	border: "#e5e9ef",
	input: "#f4f6f9",
	disabled: "#cbd3de",
	primary: "#0b1b2e",
	primaryFg: "#ffffff",
	primaryHighlight: "#e3e9f2",
	brand: "#1556c9",
	brandFg: "#ffffff",
	focus: "#1556c9",
	success: "#15803d",
	successSoft: "#e3f6e9",
	danger: "#c81e1e",
	dangerSoft: "#fde8e8",
	warning: "#b45309",
	warningSoft: "#fef3c7",
};

const dark: ThemeColors = {
	background: "#0f1722",
	card: "#18222f",
	muted: "#222d3b",
	foreground: "#e8eef6",
	secondaryForeground: "#c2ccd8",
	mutedForeground: "#8e9db0",
	placeholder: "#66768a",
	border: "#253142",
	input: "#18222f",
	disabled: "#3a4759",
	primary: "#e8eef6",
	primaryFg: "#0b1b2e",
	primaryHighlight: "#26344a",
	brand: "#123b80",
	brandFg: "#ffffff",
	focus: "#5b93e6",
	success: "#22a05a",
	successSoft: "#15301f",
	danger: "#e5484d",
	dangerSoft: "#3a1a1c",
	warning: "#f59e0b",
	warningSoft: "#3a2a0c",
};

export function themeColors(isDark: boolean): ThemeColors {
	return isDark ? dark : light;
}

/**
 * The home screen's sky: the brand blue at the top fading to a warm sand at
 * the bottom, with two soft glows behind the content. Its cards are frosted
 * panels — a translucent fill instead of a solid surface.
 */
export type HomePalette = {
	stops: { offset: number; color: string }[];
	glowCool: string;
	glowWarm: string;
	/** Fill of a frosted panel laid on the sky. */
	glass: string;
	/** Text on a frosted panel that isn't the main figure. */
	glassMuted: string;
	glassDivider: string;
	/** The pill under the balance. */
	chip: string;
};

const homeLight: HomePalette = {
	stops: [
		{ offset: 0, color: "#1556c9" },
		{ offset: 0.28, color: "#2468d8" },
		{ offset: 0.46, color: "#5ba2ee" },
		{ offset: 0.62, color: "#8cc2f2" },
		{ offset: 0.8, color: "#cfe1ee" },
		{ offset: 1, color: "#ebddcb" },
	],
	glowCool: "#62b6ff",
	glowWarm: "#f2c49b",
	glass: "rgba(255,255,255,0.55)",
	glassMuted: "#3a4b61",
	glassDivider: "rgba(11,27,46,0.12)",
	chip: "rgba(6,20,45,0.35)",
};

const homeDark: HomePalette = {
	stops: [
		{ offset: 0, color: "#0e3a85" },
		{ offset: 0.3, color: "#0f2f66" },
		{ offset: 0.55, color: "#10244a" },
		{ offset: 0.8, color: "#0f1a2c" },
		{ offset: 1, color: "#0f1722" },
	],
	glowCool: "#1d5fbf",
	glowWarm: "#6b4a2e",
	glass: "rgba(24,34,47,0.72)",
	glassMuted: "#a7b4c5",
	glassDivider: "rgba(232,238,246,0.12)",
	chip: "rgba(0,0,0,0.3)",
};

export function homePalette(isDark: boolean): HomePalette {
	return isDark ? homeDark : homeLight;
}

/** The app's one typeface. Its weights are linked natively (see app.json),
 *  so `fontWeight` picks the matching file on both platforms. */
export const FONT_FAMILY = "Manrope";

/** Corner radii, smallest to largest. */
export const RADIUS = {
	/** A 20–24px badge or swatch. */
	xs: 8,
	/** A 32px icon tile. */
	sm: 10,
	/** A 40px icon tile. */
	md: 14,
	/** Fields and pickers. */
	field: 16,
	/** A grouped panel. */
	group: 20,
	/** A tappable tile. */
	tile: 22,
	/** The sheet every screen sits on. */
	sheet: 32,
} as const;
