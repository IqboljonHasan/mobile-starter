import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { Appearance } from "react-native";
import { getSetting, setSetting } from "@/lib/storage";

export type ThemeMode = "light" | "dark" | "system";

export const THEME_MODE_LABELS: Record<ThemeMode, string> = {
	light: "Light",
	dark: "Dark",
	system: "System",
};

const SETTING_KEY = "theme_mode";

function isThemeMode(value: string): value is ThemeMode {
	return value === "light" || value === "dark" || value === "system";
}

type ThemeModeContextType = {
	mode: ThemeMode;
	setMode: (mode: ThemeMode) => Promise<void>;
};

const ThemeModeContext = createContext<ThemeModeContextType>({
	mode: "system",
	setMode: async () => {},
});

/**
 * Owns the persisted light/dark/system preference and pushes it into RN's
 * `Appearance`, which is what react-native-css reads to resolve the
 * `prefers-color-scheme` media query that the semantic tokens in global.css
 * hang off. `"unspecified"` is RN's way of handing control back to the device.
 *
 * Read the *resolved* scheme through `useTheme()` — this context only carries
 * the preference, which is a different thing from the active scheme whenever
 * the mode is "system".
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
	const [mode, setModeState] = useState<ThemeMode>("system");

	useEffect(() => {
		getSetting(SETTING_KEY, "system").then((value) => {
			if (isThemeMode(value)) {
				setModeState(value);
				Appearance.setColorScheme(value === "system" ? "unspecified" : value);
			}
		});
		// Loading once on mount is the intent — re-running would fight a
		// preference the user just changed.
	}, []);

	const setMode = useCallback(async (next: ThemeMode) => {
		setModeState(next);
		Appearance.setColorScheme(next === "system" ? "unspecified" : next);
		await setSetting(SETTING_KEY, next);
	}, []);

	return (
		<ThemeModeContext.Provider value={{ mode, setMode }}>
			{children}
		</ThemeModeContext.Provider>
	);
}

export function useThemeMode() {
	return useContext(ThemeModeContext);
}
