import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Thin, failure-tolerant wrapper around AsyncStorage for user preferences.
 *
 * Preferences are cosmetic — a read or write that fails should never take a
 * screen down with it, so both helpers swallow errors and `getSetting` falls
 * back to the caller's default.
 */

const PREFIX = "starter:";

export async function getSetting(key: string, fallback: string): Promise<string> {
	try {
		const value = await AsyncStorage.getItem(PREFIX + key);
		return value ?? fallback;
	} catch (e) {
		console.warn(`[storage] failed to read "${key}"`, e);
		return fallback;
	}
}

export async function setSetting(key: string, value: string): Promise<void> {
	try {
		await AsyncStorage.setItem(PREFIX + key, value);
	} catch (e) {
		console.warn(`[storage] failed to write "${key}"`, e);
	}
}

export async function removeSetting(key: string): Promise<void> {
	try {
		await AsyncStorage.removeItem(PREFIX + key);
	} catch (e) {
		console.warn(`[storage] failed to remove "${key}"`, e);
	}
}
