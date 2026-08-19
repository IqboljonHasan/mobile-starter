import { useColorScheme } from "react-native";
import { useThemeMode, type ThemeMode } from "@/contexts/ThemeContext";
import { themeColors } from "@/lib/theme";

/**
 * The single entry point for theming inside components.
 *
 *   const { isDark, tc, mode, setMode, toggleColorScheme } = useTheme();
 *
 * `tc` holds runtime color values for props that can't take a className.
 * `mode` is the stored preference ("system" included); `isDark` is the scheme
 * actually in effect right now.
 */
export function useTheme() {
	// RN's own hook, not NativeWind's — that one is deprecated in v5 and is
	// itself just a wrapper around `Appearance`.
	const colorScheme = useColorScheme();
	const { mode, setMode } = useThemeMode();
	const isDark = colorScheme === "dark";

	const toggleColorScheme = () => setMode(isDark ? "light" : "dark");

	return { isDark, tc: themeColors(isDark), mode, setMode, toggleColorScheme };
}

export type { ThemeMode };
