/**
 * The arithmetic behind drag-to-reorder, kept apart from the gesture that
 * drives it so it can be exercised without a touchscreen.
 *
 * Rows are a fixed height, which is what turns "where did this land" into a
 * division rather than a walk over measured offsets — and is why the reorder
 * list is a compact row per category rather than the full card.
 */

/** Moves one item to another index, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
	if (from < 0 || from >= items.length) return items;
	const target = Math.min(Math.max(to, 0), items.length - 1);
	if (from === target) return items;

	const next = items.slice();
	const [moved] = next.splice(from, 1);
	next.splice(target, 0, moved);
	return next;
}

/**
 * Which index a row starting at `index` lands on after being dragged `offset`
 * pixels. Runs on the UI thread as part of the gesture.
 */
export function dropTarget(
	index: number,
	offset: number,
	rowHeight: number,
	count: number,
): number {
	"worklet";
	if (rowHeight <= 0 || count <= 0) return index;
	const shifted = index + Math.round(offset / rowHeight);
	return Math.min(Math.max(shifted, 0), count - 1);
}

/**
 * Rewrites one side of the ledger into `orderedIds`, leaving every item of the
 * other type exactly where it was.
 *
 * Categories of both types share a single array, so reordering the expense list
 * must not disturb the income list interleaved with it. Ids the caller doesn't
 * mention keep their old relative order at the end, so an order captured before
 * a category was added can still be applied without dropping it.
 */
export function applyOrder<T extends { id: string; type: string }>(
	all: T[],
	type: string,
	orderedIds: string[],
): T[] {
	const pending = new Map<string, T>();
	for (const item of all) {
		if (item.type === type) pending.set(item.id, item);
	}

	const ordered: T[] = [];
	for (const id of orderedIds) {
		const item = pending.get(id);
		if (item) {
			ordered.push(item);
			pending.delete(id);
		}
	}
	for (const item of all) {
		if (item.type === type && pending.has(item.id)) ordered.push(item);
	}

	let next = 0;
	return all.map((item) => (item.type === type ? ordered[next++] : item));
}
