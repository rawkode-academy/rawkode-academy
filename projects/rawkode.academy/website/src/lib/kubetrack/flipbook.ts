export type ViewMode = "paged" | "all";

export const VIEW_MODE_KEY = "kubetrack:v1:view";

export function clampIndex(index: number, length: number): number {
	if (length <= 0 || !Number.isFinite(index)) return 0;
	return Math.min(Math.max(Math.trunc(index), 0), length - 1);
}

export const nextIndex = (index: number, length: number): number =>
	clampIndex(index + 1, length);

export const prevIndex = (index: number, length: number): number =>
	clampIndex(index - 1, length);

/** Index of the card a `#kep-N` hash points at, or null. */
export function indexFromHash(
	hash: string | null | undefined,
	ids: ReadonlyArray<string>,
): number | null {
	if (!hash) return null;
	let id = hash.startsWith("#") ? hash.slice(1) : hash;
	try {
		id = decodeURIComponent(id);
	} catch {
		return null;
	}
	const index = ids.indexOf(id);
	return index === -1 ? null : index;
}

function storage(): Storage | undefined {
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

export function readViewMode(store: Storage | undefined = storage()): ViewMode {
	try {
		return store?.getItem(VIEW_MODE_KEY) === "all" ? "all" : "paged";
	} catch {
		return "paged";
	}
}

export function writeViewMode(
	mode: ViewMode,
	store: Storage | undefined = storage(),
): void {
	try {
		store?.setItem(VIEW_MODE_KEY, mode);
	} catch {
		// Private windows and blocked storage: the toggle still works for this visit.
	}
}
