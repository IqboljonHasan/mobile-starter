import { useCallback, useEffect, useState } from "react";
import type { QazaMarks } from "@/lib/prayers";
import { getSetting, setSetting } from "@/lib/storage";

const KEY = "qaza_marks";

function parseMarks(raw: string): QazaMarks {
	try {
		const parsed: unknown = JSON.parse(raw);
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
		return Object.fromEntries(
			Object.entries(parsed).filter(([, at]) => typeof at === "number"),
		) as QazaMarks;
	} catch {
		return {};
	}
}

/**
 * Which missed prayers have been marked as made up, remembered across
 * restarts. `mark` and `unmark` are idempotent rather than a toggle, so a
 * doubled tap can't undo the mark it just made.
 */
export function useQazaMarks() {
	const [marks, setMarks] = useState<QazaMarks>({});
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		getSetting(KEY, "{}").then((raw) => {
			setMarks(parseMarks(raw));
			setLoaded(true);
		});
	}, []);

	const update = useCallback((change: (prev: QazaMarks) => QazaMarks) => {
		setMarks((prev) => {
			const next = change(prev);
			if (next !== prev) setSetting(KEY, JSON.stringify(next));
			return next;
		});
	}, []);

	const mark = useCallback(
		(key: string) =>
			update((prev) => (prev[key] !== undefined ? prev : { ...prev, [key]: Date.now() })),
		[update],
	);

	const unmark = useCallback(
		(key: string) =>
			update((prev) => {
				if (prev[key] === undefined) return prev;
				const { [key]: _removed, ...rest } = prev;
				return rest;
			}),
		[update],
	);

	return { marks, loaded, mark, unmark };
}
