// Hourly change detection (cron "0 * * * *", see src/worker.ts).
//
// Writers should call POST /api/cache/invalidate after D1 writes; this job is
// the safety net and the scheduler. It fetches every collection from the
// gateway (bypassing caches), hashes each entity, compares with the manifest
// from the previous run (KV "content:manifest") and, for every entity that
// was added, changed or deleted, or whose publication time passed since the
// last run, bumps the content generation and purges its tags: the entity
// tag, its collection tag and the entity tags it references (guests,
// authors, hosts, technologies, show, course).
import type { ContentEnv, ContentKV } from "./env";
import { queryGateway } from "./gateway";
import { type PurgeTags, purgeAndSettle, SETTLE_MS } from "./invalidate";
import { bumpGeneration, hashString, now, stableStringify } from "./kv-cache";
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
	relatedTags,
} from "./mappers";
import {
	LIST_QUERIES,
	type ListSource,
	TECHNOLOGY_MANIFEST_QUERY,
} from "./queries";
import type { CollectionDataMap, CollectionName } from "./types";

export const MANIFEST_KEY = "content:manifest";
const MANIFEST_VERSION = 1;

export interface ManifestEntity {
	/** Hash of the entity's gateway JSON. */
	h: string;
	/** Publication time (epoch ms), when the collection schedules entries. */
	p?: number;
	/** Entity tags of referenced entities. */
	r?: string[];
}

export interface Manifest {
	version: number;
	generatedAt: number;
	/** Keyed by "<collection>:<id>". */
	entities: Record<string, ManifestEntity>;
}

export interface ManifestDiff {
	added: string[];
	changed: string[];
	deleted: string[];
	published: string[];
	tags: string[];
}

// biome-ignore lint/suspicious/noExplicitAny: raw gateway JSON
type Raw = Record<string, any>;

function entityRecord<C extends CollectionName>(
	collection: C,
	raw: unknown,
	data: CollectionDataMap[C],
): ManifestEntity {
	const at = publicationDate(collection, data)?.getTime();
	const related = relatedTags(collection, data);
	return {
		h: hashString(stableStringify(raw)),
		...(at !== undefined && !Number.isNaN(at) ? { p: at } : {}),
		...(related.length > 0 ? { r: related } : {}),
	};
}

/** Turn raw gateway lists into a manifest. */
export function buildManifest(
	sources: Partial<Record<ListSource, Raw[]>>,
	generatedAt: number,
): Manifest {
	const entities: Record<string, ManifestEntity> = {};
	const put = <C extends CollectionName>(
		collection: C,
		id: string,
		raw: unknown,
		data: CollectionDataMap[C],
	) => {
		entities[`${collection}:${id}`] = entityRecord(collection, raw, data);
	};
	const rows = (source: ListSource) =>
		(sources[source] ?? []).filter(
			(r) => r && typeof r.id === "string" && r.id,
		);
	for (const r of rows("videos")) put("videos", r.id, r, mapVideo(r));
	for (const r of rows("shows")) put("shows", r.id, r, mapShow(r));
	for (const r of rows("people")) put("people", r.id, r, mapPerson(r));
	for (const r of rows("technologies"))
		put("technologies", r.id, r, mapTechnology(r));
	for (const r of rows("articles")) put("articles", r.id, r, mapArticle(r));
	for (const r of rows("news")) put("news", r.id, r, mapNews(r));
	for (const r of rows("changelog")) put("changelog", r.id, r, mapChangelog(r));
	for (const r of rows("adrs")) put("adrs", r.id, r, mapAdr(r));
	for (const r of rows("testimonials"))
		put("testimonials", r.id, r, mapTestimonial(r));
	for (const r of rows("learningPaths"))
		put("learningPaths", r.id, r, mapLearningPath(r));
	for (const course of rows("courses")) {
		const { modules, ...rest } = course;
		put("courses", course.id, rest, mapCourse(course));
		for (const m of Array.isArray(modules) ? modules : []) {
			if (!m) continue;
			const data = mapCourseModule(m, course.id);
			const id =
				typeof m.id === "string" && m.id.includes("/")
					? m.id
					: courseModuleId(data.course.id, data.slug);
			put("courseModules", id, m, data);
		}
	}
	return { version: MANIFEST_VERSION, generatedAt, entities };
}

function tagsFor(key: string, entity: ManifestEntity | undefined): string[] {
	const collection = key.slice(0, key.indexOf(":"));
	return [collection, key, ...(entity?.r ?? [])];
}

/**
 * Compare two manifests. `previous` undefined means a first run: nothing is
 * reported (the manifest becomes the baseline).
 */
export function diffManifests(
	previous: Manifest | undefined,
	next: Manifest,
	at: number = next.generatedAt,
): ManifestDiff {
	const diff: ManifestDiff = {
		added: [],
		changed: [],
		deleted: [],
		published: [],
		tags: [],
	};
	if (!previous) return diff;
	const tags = new Set<string>();
	const since = previous.generatedAt;
	for (const [key, entity] of Object.entries(next.entities)) {
		const before = previous.entities[key];
		if (!before) {
			diff.added.push(key);
			for (const t of tagsFor(key, entity)) tags.add(t);
			continue;
		}
		if (before.h !== entity.h) {
			diff.changed.push(key);
			// Tags of both versions: a removed guest's page lists it too.
			for (const t of [...tagsFor(key, entity), ...tagsFor(key, before)])
				tags.add(t);
			continue;
		}
		if (entity.p !== undefined && entity.p > since && entity.p <= at) {
			diff.published.push(key);
			for (const t of tagsFor(key, entity)) tags.add(t);
		}
	}
	for (const [key, entity] of Object.entries(previous.entities)) {
		if (!(key in next.entities)) {
			diff.deleted.push(key);
			for (const t of tagsFor(key, entity)) tags.add(t);
		}
	}
	diff.tags = [...tags];
	return diff;
}

/** Fetch every collection fresh from the gateway (no caches). */
export async function fetchSources(
	env: ContentEnv,
): Promise<Record<ListSource, Raw[]>> {
	const sources = Object.keys(LIST_QUERIES) as ListSource[];
	const results = await Promise.all(
		sources.map(async (source) => {
			const spec =
				source === "technologies"
					? TECHNOLOGY_MANIFEST_QUERY
					: LIST_QUERIES[source];
			const data = await queryGateway<Record<string, Raw[] | null>>(
				env,
				spec.query,
				{},
				spec.operationName,
				// The cron has no visitor waiting; allow the full manifests time.
				30_000,
			);
			const list = data[spec.root];
			if (!Array.isArray(list)) {
				throw new Error(`${spec.operationName} returned no list`);
			}
			return [source, list] as const;
		}),
	);
	return Object.fromEntries(results) as Record<ListSource, Raw[]>;
}

export interface ChangeDetectionResult {
	baseline: boolean;
	entities: number;
	diff: ManifestDiff;
	generation?: number;
	durationMs: number;
}

export interface ChangeDetectionDeps {
	env: ContentEnv;
	kv: ContentKV;
	purge?: PurgeTags;
	/** Delay before the second purge (default SETTLE_MS; tests pass 0). */
	settleMs?: number;
	wait?: (ms: number) => Promise<void>;
	/** Defaults to fetching the gateway. */
	loadSources?: () => Promise<Partial<Record<ListSource, Raw[]>>>;
}

export async function runChangeDetection(
	deps: ChangeDetectionDeps,
): Promise<ChangeDetectionResult> {
	const started = now();
	// A failed source aborts the run: storing a partial manifest would report
	// every entity of the missing collection as deleted next hour.
	const sources = await (deps.loadSources ?? (() => fetchSources(deps.env)))();
	const t = now();
	const next = buildManifest(sources, t);
	const previous = await deps.kv
		.get<Manifest>(MANIFEST_KEY, { type: "json" })
		.then((m) => (m && m.version === MANIFEST_VERSION ? m : undefined))
		.catch(() => undefined);
	const diff = diffManifests(previous, next, t);
	let generation: number | undefined;
	if (diff.tags.length > 0) {
		generation = (await bumpGeneration(deps.kv)).generation;
		// A failed purge throws before the manifest is stored, so the next run
		// reports (and purges) the same changes again.
		if (deps.purge)
			await purgeAndSettle(
				deps.purge,
				diff.tags,
				deps.settleMs ?? SETTLE_MS,
				deps.wait,
			);
	}
	await deps.kv.put(MANIFEST_KEY, JSON.stringify(next));
	const result: ChangeDetectionResult = {
		baseline: !previous,
		entities: Object.keys(next.entities).length,
		diff,
		...(generation !== undefined ? { generation } : {}),
		durationMs: now() - started,
	};
	console.log(
		JSON.stringify({
			event: "content.change-detection",
			baseline: result.baseline,
			entities: result.entities,
			added: diff.added.length,
			changed: diff.changed.length,
			deleted: diff.deleted.length,
			published: diff.published.length,
			purgedTags: diff.tags.length,
			generation,
			durationMs: result.durationMs,
			sample: [
				...diff.added,
				...diff.changed,
				...diff.deleted,
				...diff.published,
			].slice(0, 20),
		}),
	);
	return result;
}
