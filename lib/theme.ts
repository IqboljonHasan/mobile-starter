/**
 * Runtime color values that mirror the semantic tokens from global.css.
 * Use these ONLY for props that don't support className (icon color,
 * placeholderTextColor, shadowColor, native navigator options, …).
 * For anything that supports className, use the semantic classes directly:
 *   bg-background, bg-card, bg-muted, bg-input, bg-primary, bg-primary-highlight,
 *   text-foreground, text-secondary-foreground, text-muted-foreground,
 *   border-border, bg-disabled, etc.
 *
 * Keep every value here in sync with its counterpart in global.css.
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
	primaryHighlight: string;
	success: string;
	danger: string;
	warning: string;
};

const light: ThemeColors = {
	background: "#f8f3f1",
	card: "#ffffff",
	muted: "#e4e0de",
	foreground: "#111827",
	secondaryForeground: "#1f2937",
	mutedForeground: "#6b7280",
	placeholder: "#9ca3af",
	border: "#e5e7eb",
	input: "#f3f4f6",
	disabled: "#d1d5db",
	primary: "#ff6a00",
	primaryHighlight: "#ffe4cc",
	success: "#22c55e",
	danger: "#ef4444",
	warning: "#f59e0b",
};

const dark: ThemeColors = {
	background: "#030712",
	card: "#111827",
	muted: "#1f2937",
	foreground: "#f9fafb",
	secondaryForeground: "#e5e7eb",
	mutedForeground: "#9ca3af",
	placeholder: "#6b7280",
	border: "#1f2937",
	input: "#1f2937",
	disabled: "#374151",
	primary: "#ff6a00",
	primaryHighlight: "#4a2010",
	success: "#22c55e",
	danger: "#ef4444",
	warning: "#f59e0b",
};

export function themeColors(isDark: boolean): ThemeColors {
	return isDark ? dark : light;
}
