import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getSetting, setSetting } from "@/lib/storage";

export type FontSizeScale = "small" | "normal" | "large" | "xlarge";

export const FONT_SCALE_VALUES: Record<FontSizeScale, number> = {
	small: 0.875,
	normal: 1,
	large: 1.15,
	xlarge: 1.3,
};

export const FONT_SCALE_LABELS: Record<FontSizeScale, string> = {
	small: "Kichik",
	normal: "Oddiy",
	large: "Katta",
	xlarge: "Juda katta",
};

const SETTING_KEY = "font_size_scale";

type FontSizeContextType = {
	scale: FontSizeScale;
	multiplier: number;
	setScale: (scale: FontSizeScale) => Promise<void>;
};

const FontSizeContext = createContext<FontSizeContextType>({
	scale: "normal",
	multiplier: 1,
	setScale: async () => {},
});

/**
 * App-wide text scale preference. Components don't read this directly — they
 * use `useFont()`, which turns the multiplier into concrete pixel sizes.
 */
export function FontSizeProvider({ children }: { children: ReactNode }) {
	const [scale, setScaleState] = useState<FontSizeScale>("normal");

	useEffect(() => {
		getSetting(SETTING_KEY, "normal").then((value) => {
			if (value in FONT_SCALE_VALUES) setScaleState(value as FontSizeScale);
		});
	}, []);

	const setScale = useCallback(async (next: FontSizeScale) => {
		setScaleState(next);
		await setSetting(SETTING_KEY, next);
	}, []);

	return (
		<FontSizeContext.Provider
			value={{ scale, multiplier: FONT_SCALE_VALUES[scale], setScale }}
		>
			{children}
		</FontSizeContext.Provider>
	);
}

export function useFontSize() {
	return useContext(FontSizeContext);
}
