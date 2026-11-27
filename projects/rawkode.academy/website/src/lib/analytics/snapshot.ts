// The numbers on /analytics move slowly, so they are computed once a day (cron
// in worker.ts) and kept in KV. The page reads one key instead of running
// Basin SQL over the whole lake on every view. An empty KV (first deploy, or
// the key expired) is filled on demand.
import {
	type LakeVideo,
	lakeCatalogueSql,
	videoIdPattern,
} from "../../../../../../packages/guest-scope/index";
import { guestVideosSql, parseAcademyVideos } from "@/lib/analytics/guest";
import { GUEST_SCOPE_QUERY, youtubeIds } from "../../../../../../packages/guest-scope/index";
import type { ContentEnv } from "@/lib/live-content/env";
import { queryGateway } from "@/lib/live-content/gateway";
import { type ReachQuery, reachQueries, reachWindow, watchViewsSql } from "@/lib/analytics/reach";
import type { ContentKV } from "@/lib/live-content/env";
import { TABLE } from "@/lib/analytics/queries";
import { type BasinConfig, basinQuery, type Row } from "@/server/basin";

export const SNAPSHOT_KEY = "analytics:snapshot:v2";
/** Longer than a day, so one missed refresh still serves the last numbers. */
const SNAPSHOT_TTL_SECONDS = 7 * 86_400;

export type VideoStats = {
	views: { d90: number; lifetime: number };
	minutes: { d90: number; lifetime: number };
};

export type Snapshot = {
	generatedAt: string;
	reach: Record<ReachQuery, Row[]>;
	/** Every YouTube video in the lake, for matching Academy videos by title. */
	lake: LakeVideo[];
	/** Per YouTube video ID. */
	videos: Record<string, VideoStats>;
	/** Every Academy video, with its YouTube video where one is certain. Partner analytics joins on it. */
	academy: {
		id: string;
		title: string;
		slug: string;
		youtube: string | null;
		/** Lesson page key ("courses/<course>/<lesson>") when the video is a course lesson. */
		lesson: string | null;
	}[];
	/** Human page views per key: a video slug (/watch/<slug>) or a lesson page ("courses/<course>/<lesson>"). */
	watch: Record<string, { d90: number; lifetime: number }>;
};

const num = (value: unknown) => Number(value ?? 0);

// YouTube's public lifetime view count per video, recorded daily by the
// youtube-control reconciliation (latest observation per video).
export const publicViewsSql = (videoIds: readonly string[]) => `
SELECT video, views FROM (
	SELECT json_get_str(value, 'data', 'video') AS video,
		json_get_int(value, 'data', 'viewCount') AS views,
		ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'video') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
	FROM ${TABLE}
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.video_stats'
		AND json_get_str(value, 'data', 'video') IN (${videoIds.map((id) => `'${id}'`).join(", ")})
) WHERE rn = 1`;

/**
 * The Analytics API's per-day views can sum to less than the count YouTube
 * shows on the watch page, so a video's lifetime never goes below the public
 * count, and its 90 days never above its lifetime.
 */
export function withPublicViews(stats: VideoStats, publicViews: number | undefined): VideoStats {
	if (publicViews === undefined || publicViews <= stats.views.lifetime) return stats;
	return { ...stats, views: { d90: Math.min(stats.views.d90, publicViews), lifetime: publicViews } };
}

/** The snapshot key for a page path: "<slug>" for /watch/<slug>, "courses/<course>/<lesson>" for a lesson. */
export function viewKey(path: string): string | null {
	const clean = path.replace(/[?#].*$/, "").replace(/\/+$/, "");
	const watch = /^\/watch\/([^/]+)$/.exec(clean);
	if (watch) return watch[1] ?? null;
	const lesson = /^\/courses\/([^/]+)\/([^/]+)$/.exec(clean);
	return lesson ? `courses/${lesson[1]}/${lesson[2]}` : null;
}

const LESSONS_QUERY = `query AnalyticsLessons { allCourses { modules { courseId slug video { id } } } }`;

// Basin queries run uncached here (ttl 0 is not an option on the client), so a
// refresh always reads the lake; the page never does.
export async function buildSnapshot(
	config: BasinConfig,
	now = new Date(),
	env?: ContentEnv,
): Promise<Snapshot> {
	const window = reachWindow(now);
	const queries = reachQueries(window);
	const names = Object.keys(queries) as ReachQuery[];
	const [reachRows, catalogue] = await Promise.all([
		Promise.all(
			names.map((name) => basinQuery(config, queries[name], { ttlSeconds: 60 })),
		),
		basinQuery(config, lakeCatalogueSql, { ttlSeconds: 60 }),
	]);
	const watch: Snapshot["watch"] = {};
	for (const row of await basinQuery(config, watchViewsSql(window), { ttlSeconds: 60 })) {
		const key = viewKey(String(row.path ?? ""));
		if (!key) continue;
		const entry = (watch[key] ??= { d90: 0, lifetime: 0 });
		entry.d90 += num(row.views_d90);
		entry.lifetime += num(row.views_lifetime);
	}
	const lake = catalogue.flatMap((row) =>
		typeof row.video === "string" && typeof row.title === "string"
			? [{ video: row.video, title: row.title }]
			: [],
	);
	const ids = [
		...new Set(lake.map((video) => video.video).filter((id) => videoIdPattern.test(id))),
	];
	const videos: Record<string, VideoStats> = {};
	if (ids.length > 0) {
		const rows = await basinQuery(config, guestVideosSql(ids, window), {
			ttlSeconds: 60,
		});
		for (const row of rows) {
			videos[String(row.video)] = {
				views: { d90: num(row.views_d90), lifetime: num(row.views_lifetime) },
				minutes: { d90: num(row.minutes_d90), lifetime: num(row.minutes_lifetime) },
			};
		}
	}
	if (ids.length > 0) {
		// Best effort: before the first reconciliation there are no public counts.
		const publicRows = await basinQuery(config, publicViewsSql(ids), { ttlSeconds: 60 }).catch(() => []);
		for (const row of publicRows) {
			const stats = videos[String(row.video)];
			if (stats) videos[String(row.video)] = withPublicViews(stats, num(row.views));
		}
	}
	let academy: Snapshot["academy"] = [];
	if (env) {
		const videos = parseAcademyVideos(await queryGateway<unknown>(env, GUEST_SCOPE_QUERY));
		if (!videos) throw new Error("Academy video list unusable");
		const mapped = youtubeIds(videos, lake);
		const courses = await queryGateway<{
			allCourses: {
				modules: { courseId: string; slug: string; video: { id: string } | null }[];
			}[];
		}>(env, LESSONS_QUERY);
		const lessons = new Map<string, string>();
		for (const course of courses.allCourses ?? []) {
			for (const lesson of course.modules ?? []) {
				if (lesson.video) {
					lessons.set(lesson.video.id, `courses/${lesson.courseId}/${lesson.slug}`);
				}
			}
		}
		academy = videos.map((video) => ({
			id: video.id,
			title: video.title,
			slug: video.slug,
			youtube: mapped.get(video.id) ?? null,
			lesson: lessons.get(video.id) ?? null,
		}));
	}
	return {
		generatedAt: now.toISOString(),
		reach: Object.fromEntries(
			names.map((name, i) => [name, reachRows[i] ?? []]),
		) as Snapshot["reach"],
		lake,
		videos,
		academy,
		watch,
	};
}

/** Computes the snapshot and stores it. Throws when any source fails, leaving the previous snapshot in place. */
export async function refreshSnapshot(
	config: BasinConfig,
	kv: ContentKV,
	now = new Date(),
	env?: ContentEnv,
): Promise<Snapshot> {
	const snapshot = await buildSnapshot(config, now, env);
	await kv.put(SNAPSHOT_KEY, JSON.stringify(snapshot), {
		expirationTtl: SNAPSHOT_TTL_SECONDS,
	});
	return snapshot;
}

/** The stored snapshot, filled on demand when there is none. */
export async function loadSnapshot(
	config: BasinConfig,
	kv: ContentKV | undefined,
	env?: ContentEnv,
): Promise<Snapshot> {
	const stored = await kv?.get<Snapshot>(SNAPSHOT_KEY, { type: "json" });
	if (stored) return stored;
	return kv ? refreshSnapshot(config, kv, new Date(), env) : buildSnapshot(config, new Date(), env);
}
