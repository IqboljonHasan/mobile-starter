/**
 * Folds text for a forgiving "contains" search: case, and the four ways the
 * Uzbek apostrophe gets typed (o'g'il, oʻgʻil, o’g’il, o`g`il), so a search
 * finds a name however the keyboard spelled it.
 */
export function foldForSearch(text: string): string {
	return text.toLocaleLowerCase().replace(/[ʻʼ’‘`´]/g, "'").trim();
}

/** Whether any of `fields` contains the (already folded) `query`. An empty query matches all. */
export function matchesSearch(query: string, fields: (string | null | undefined)[]): boolean {
	if (!query) return true;
	return fields.some((field) => !!field && foldForSearch(field).includes(query));
}
