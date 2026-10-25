// Loads whole collections from the gateway (through the KV/memo cache) and
// maps them to entries. Collections are small (hundreds of rows), so single
// entries are looked up in the cached list; only technology profile bodies
// need a separate request.
import { getContentEnv, runInBackground } from "./env";
import { queryGateway } from "./gateway";
import { type CachedValue, cachedQuery, now } from "./kv-cache";
import {
	courseModuleId,
	mapAdr,
	mapArticle,
	mapChangelog,
	mapCourse,
	mapCourseModule,
	mapLearningPath,
	mapNews,
	mapPerson,
	mapShow,
	mapTechnology,
	mapTestimonial,
	mapVideo,
	publicationDate,
	toEntry,
} from "./mappers";
import {
	LIST_QUERIES,
	type ListSource,
	TECHNOLOGY_BY_ID_QUERY,
} from "./queries";
import type {
	CollectionDataMap,
	CollectionName,
	ContentEntry,
	VideoData,
} from "./types";

// biome-ignore lint/suspicious/noExplicitAny: raw gateway JSON
type Raw = Record<string, any>;

const SOURCE: Record<CollectionName, ListSource> = {
	videos: "videos",
	shows: "shows",
	people: "people",
	technologies: "technologies",
	articles: "articles",
	news: "news",
	changelog: "changelog",
	adrs: "adrs",
	testimonials: "testimonials",
	courses: "courses",
	courseModules: "courses",
	learningPaths: "learningPaths",
};

export interface LoadedCollection<C extends CollectionName> {
	entries: ContentEntry<C>[];
	byId: Map<string, ContentEntry<C>>;
	fetchedAt: number;
	stale: boolean;
	/**
	 * Every publication time (epoch ms), ascending. The mapped collection is
	 * memoised per payload for minutes, so "the next scheduled entry" must be
	 * computed against the request time: use nextPublishAfter().
	 */
	publishTimes: number[];
}

/** Earliest publication time after `at` (epoch ms), if any. */
export function nextPublishAfter(
	loaded: Pick<LoadedCollection<CollectionName>, "publishTimes">,
	at: number,
): number | undefined {
	const times = loaded.publishTimes;
	let lo = 0;
	let hi = times.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if ((times[mid] as number) <= at) lo = mid + 1;
		else hi = mid;
	}
	return times[lo];
}

async function fetchSource(source: ListSource): Promise<CachedValue<Raw[]>> {
	const env = await getContentEnv();
	const { query, operationName, root } = LIST_QUERIES[source];
	return cachedQuery<Raw[]>(
		`list:${source}`,
		{},
		async () => {
			const data = await queryGateway<Record<string, Raw[] | null>>(
				env,
				query,
				{},
				operationName,
			);
			return data[root] ?? [];
		},
		{ kv: env.CONTENT_CACHE, background: runInBackground },
	);
}

function mapRows<C extends CollectionName>(
	collection: C,
	rows: Raw[],
	t: number,
): ContentEntry<C>[] {
	const entry = <K extends CollectionName>(
		c: K,
		id: string,
		data: CollectionDataMap[K],
	) => toEntry(c, id, data, t);
	const valid = rows.filter((r) => r && typeof r.id === "string" && r.id);
	switch (collection) {
		case "videos":
			return valid.map((r) =>
				entry("videos", r.id, mapVideo(r)),
			) as ContentEntry<C>[];
		case "shows":
			return valid.map((r) =>
				entry("shows", r.id, mapShow(r)),
			) as ContentEntry<C>[];
		case "people":
			return valid.map((r) =>
				entry("people", r.id, mapPerson(r)),
			) as ContentEntry<C>[];
		case "technologies":
			return valid.map((r) =>
				entry("technologies", r.id, mapTechnology(r)),
			) as ContentEntry<C>[];
		case "articles":
			return valid.map((r) =>
				entry("articles", r.id, mapArticle(r)),
			) as ContentEntry<C>[];
		case "news":
			return valid.map((r) =>
				entry("news", r.id, mapNews(r)),
			) as ContentEntry<C>[];
		case "changelog":
			return valid.map((r) =>
				entry("changelog", r.id, mapChangelog(r)),
			) as ContentEntry<C>[];
		case "adrs":
			return valid.map((r) =>
				entry("adrs", r.id, mapAdr(r)),
			) as ContentEntry<C>[];
		case "testimonials":
			return valid.map((r) =>
				entry("testimonials", r.id, mapTestimonial(r)),
			) as ContentEntry<C>[];
		case "courses":
			return valid.map((r) =>
				entry("courses", r.id, mapCourse(r)),
			) as ContentEntry<C>[];
		case "courseModules":
			return valid.flatMap((course) =>
				(Array.isArray(course.modules) ? course.modules : [])
					.filter((m: Raw) => m && (m.id || m.slug))
					.map((m: Raw) => {
						const data = mapCourseModule(m, course.id);
						const id =
							typeof m.id === "string" && m.id.includes("/")
								? m.id
								: courseModuleId(data.course.id, data.slug);
						return entry("courseModules", id, data);
					}),
			) as ContentEntry<C>[];
		case "learningPaths":
			return valid.map((r) =>
				entry("learningPaths", r.id, mapLearningPath(r)),
			) as ContentEntry<C>[];
	}
}

// The old glob loaders returned entries in content-file path order, and many
// call sites rely on it: some never sort (llms.txt courses) and the stable
// sorts by date keep it for ties. Reproduce that order instead of the
// gateway's.
function fileOrderKey(entry: ContentEntry<CollectionName>): string {
	if (entry.collection !== "videos") return entry.id;
	const video = entry.data as VideoData;
	const year = Number.isNaN(video.publishedAt.getTime())
		? ""
		: String(video.publishedAt.getUTCFullYear());
	const dir = video.show ? `shows/${video.show.id}` : "standalone";
	return `${dir}/${year}/${video.slug}`;
}

function sortLikeContentFiles<C extends CollectionName>(
	entries: ContentEntry<C>[],
): ContentEntry<C>[] {
	const keyed = entries.map((entry) => [fileOrderKey(entry), entry] as const);
	keyed.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
	return keyed.map(([, entry]) => entry);
}

// Mapped collections are memoised per cached payload object, so an isolate
// maps each generation of a collection once.
const mapped = new WeakMap<
	object,
	Map<CollectionName, LoadedCollection<CollectionName>>
>();

export async function loadCollection<C extends CollectionName>(
	collection: C,
): Promise<LoadedCollection<C>> {
	const cached = await fetchSource(SOURCE[collection]);
	let perPayload = mapped.get(cached);
	if (!perPayload) {
		perPayload = new Map();
		mapped.set(cached, perPayload);
	}
	const existing = perPayload.get(collection);
	if (existing) return existing as unknown as LoadedCollection<C>;
	const t = now();
	const entries = sortLikeContentFiles(mapRows(collection, cached.value, t));
	const publishTimes: number[] = [];
	for (const entry of entries) {
		const at = publicationDate(collection, entry.data)?.getTime();
		if (at !== undefined && !Number.isNaN(at)) publishTimes.push(at);
	}
	publishTimes.sort((a, b) => a - b);
	const loaded: LoadedCollection<C> = {
		entries,
		byId: new Map(entries.map((e) => [e.id, e])),
		fetchedAt: cached.fetchedAt,
		stale: cached.stale,
		publishTimes,
	};
	perPayload.set(
		collection,
		loaded as unknown as LoadedCollection<CollectionName>,
	);
	return loaded;
}

/** A technology with its profile body (the list omits bodies). */
export async function loadTechnologyWithBody(
	id: string,
): Promise<ContentEntry<"technologies"> | undefined> {
	const env = await getContentEnv();
	const cached = await cachedQuery<Raw | null>(
		"technologyById",
		{ id },
		async () => {
			const data = await queryGateway<Record<string, Raw | null>>(
				env,
				TECHNOLOGY_BY_ID_QUERY.query,
				{ id },
				TECHNOLOGY_BY_ID_QUERY.operationName,
			);
			return data[TECHNOLOGY_BY_ID_QUERY.root] ?? null;
		},
		{ kv: env.CONTENT_CACHE, background: runInBackground },
	);
	if (!cached.value?.id) return undefined;
	return toEntry(
		"technologies",
		cached.value.id,
		mapTechnology(cached.value),
		now(),
	);
}
