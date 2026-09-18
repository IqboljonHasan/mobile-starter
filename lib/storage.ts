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

/**
 * JSON-valued counterparts for the ledger's own data.
 *
 * Unlike preferences, this is the user's records — a *write* failure is not
 * cosmetic, so `setJSON` reports it to the caller instead of swallowing it.
 * Reads stay forgiving: unparseable stored data falls back to the default
 * rather than leaving the app with no screen to show.
 */
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
	try {
		const raw = await AsyncStorage.getItem(PREFIX + key);
		if (raw == null) return fallback;
		return JSON.parse(raw) as T;
	} catch (e) {
		console.warn(`[storage] failed to read "${key}"`, e);
		return fallback;
	}
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
	await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
}
