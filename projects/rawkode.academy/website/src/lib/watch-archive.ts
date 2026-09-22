/** Server-only archive selection. No fetching, mutation, or client state. */
export const WATCH_PAGE_SIZE = 24;

interface WatchVideo {
	data: {
		title: string;
		description: string;
		subtitle?: string | undefined;
		technologies?: readonly unknown[] | undefined;
		guests?: readonly unknown[] | undefined;
		show?: unknown;
	};
}

interface NamedEntry {
	id: string;
	data: { name: string; id?: string | undefined };
}

interface ShowEntry {
	id: string;
	data: { id?: string | undefined; hosts?: readonly unknown[] | undefined };
}

interface WatchArchiveOptions {
	query?: string | null | undefined;
	page?: string | null | undefined;
	technologies: readonly NamedEntry[];
	people: readonly NamedEntry[];
	shows: readonly ShowEntry[];
}

const referenceId = (reference: unknown): string => {
	if (typeof reference === "string") return reference.replace(/\/index$/, "");
	if (
		reference &&
		typeof reference === "object" &&
		"id" in reference &&
		typeof reference.id === "string"
	) {
		return reference.id.replace(/\/index$/, "");
	}
	return "";
};

const normalizedText = (text: string) =>
	text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");

function entryMap<T extends { id: string; data: { id?: string | undefined } }>(
	entries: readonly T[],
) {
	const map = new Map<string, T>();
	for (const entry of entries) {
		map.set(referenceId(entry.id), entry);
		if (entry.data.id) map.set(referenceId(entry.data.id), entry);
	}
	return map;
}

/** Preserve published-video ordering and the original content objects. */
export function selectWatchArchive<T extends WatchVideo>(
	videos: readonly T[],
	options: WatchArchiveOptions,
) {
	const query = (options.query ?? "").trim().replace(/\s+/g, " ");
	const terms = normalizedText(query).split(" ").filter(Boolean);
	const technologies = entryMap(options.technologies);
	const people = entryMap(options.people);
	const shows = entryMap(options.shows);
	const names = (
		references: readonly unknown[],
		entries: Map<string, NamedEntry>,
	) =>
		references.flatMap((reference) => {
			const id = referenceId(reference);
			return [id, entries.get(id)?.data.name ?? ""];
		});
	const matching =
		terms.length === 0
			? videos
			: videos.filter(({ data }) => {
					const show = shows.get(referenceId(data.show));
					const text = normalizedText(
						[
							data.title,
							data.description,
							data.subtitle ?? "",
							...names(data.technologies ?? [], technologies),
							...names(
								[...(data.guests ?? []), ...(show?.data.hosts ?? [])],
								people,
							),
						].join(" "),
					);
					return terms.every((term) => text.includes(term));
				});
	const total = matching.length;
	const pageCount = Math.max(1, Math.ceil(total / WATCH_PAGE_SIZE));
	const rawPage = options.page ?? "1";
	// Only whole, nonnegative decimal pages are accepted. Huge positive values
	// clamp to the last page, including numbers exceeding JavaScript's range.
	const requestedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
	const page = Math.min(pageCount, Math.max(1, requestedPage));
	const offset = (page - 1) * WATCH_PAGE_SIZE;
	const items = matching.slice(offset, offset + WATCH_PAGE_SIZE);
	return {
		query,
		page,
		pageCount,
		total,
		items,
		first: total ? offset + 1 : 0,
		last: offset + items.length,
		showFeatured: query.length === 0 && page === 1,
	};
}

export function watchArchiveHref(query: string, page = 1): string {
	const params = new URLSearchParams();
	if (query) params.set("q", query);
	if (page > 1) params.set("page", String(page));
	return `/watch${params.size ? `?${params}` : ""}`;
}
