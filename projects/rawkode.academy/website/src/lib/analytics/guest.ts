// A signed-in guest's (or show host's) own YouTube totals for /analytics: the
// episodes they appear in, summed over 90 days and lifetime. Who sees which
// episode is decided by packages/guest-scope, the same code the Rawkode Tools
// MCP uses, so both show a person the same episodes.
import {
	type AcademyVideo,
	dailySql,
	GUEST_SCOPE_QUERY,
	lakeCatalogueSql,
	type LakeVideo,
	videoIdPattern,
	visibleEpisodes,
	youtubeIds,
} from "../../../../../../packages/guest-scope/index";
import { basinQuery, type BasinConfig } from "@/server/basin";
import type { ContentEnv } from "@/lib/live-content/env";
import { queryGateway } from "@/lib/live-content/gateway";
import { reachWindow, YOUTUBE_HISTORY_FROM } from "@/lib/analytics/reach";

const CACHE_SECONDS = 300;

export type GuestTotals = {
	episodes: number;
	/** Episodes that can't be tied to exactly one YouTube video: no numbers. */
	withoutNumbers: number;
	views: { d90: number; lifetime: number };
	minutes: { d90: number; lifetime: number };
};

const text = (value: unknown) => (typeof value === "string" ? value : null);
const people = (value: unknown) =>
	(Array.isArray(value) ? value : []).flatMap((item) => {
		const id = text((item as { id?: unknown })?.id);
		return id
			? [
					{
						id,
						githubHandle: text(
							(item as { githubHandle?: unknown }).githubHandle,
						),
					},
				]
			: [];
	});

/** Reads the gateway's answer to GUEST_SCOPE_QUERY; undefined when unusable. */
export function parseAcademyVideos(data: unknown): AcademyVideo[] | undefined {
	const videos = (data as { getAllVideos?: unknown } | null)?.getAllVideos;
	if (!Array.isArray(videos)) return undefined;
	return videos.flatMap((video: Record<string, unknown>) => {
		const id = text(video?.id);
		const title = text(video?.title);
		if (!id || title === null) return [];
		const show = (video.episode as { show?: Record<string, unknown> } | null)
			?.show;
		const published = video.publishedAt;
		return [
			{
				id,
				title,
				slug: text(video.slug) ?? id,
				youtubeId: text(video.youtubeId),
				publishedAt:
					typeof published === "string" || typeof published === "number"
						? new Date(published).toISOString()
						: null,
				show: text(show?.id),
				guests: people(video.guests),
				hosts: people(show?.hosts),
			},
		];
	});
}

/** The whole-lake totals SQL for these videos, 90 days and lifetime. */
export function guestTotalsSql(
	videoIds: readonly string[],
	window: ReturnType<typeof reachWindow>,
) {
	return `SELECT
	sum(CASE WHEN day >= '${window.youtubeD90}' THEN views ELSE 0 END) AS views_d90,
	sum(views) AS views_lifetime,
	sum(CASE WHEN day >= '${window.youtubeD90}' THEN minutes_watched ELSE 0 END) AS minutes_d90,
	sum(minutes_watched) AS minutes_lifetime
FROM (${dailySql(videoIds, YOUTUBE_HISTORY_FROM, window.youtubeEnd)})`;
}

async function cachedJson<T>(
	key: string,
	load: () => Promise<T>,
): Promise<T> {
	const cache =
		typeof caches === "undefined"
			? undefined
			: (caches as unknown as { default: Cache }).default;
	const request = new Request(`https://guest-scope.cache.internal/${key}`);
	const hit = await cache?.match(request);
	if (hit) return (await hit.json()) as T;
	const value = await load();
	await cache?.put(
		request,
		Response.json(value, {
			headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` },
		}),
	);
	return value;
}

const num = (value: unknown) => Number(value ?? 0);

/** undefined when there is nothing to show (not a guest or host). Throws if a source can't be read. */
export async function guestTotals(
	env: ContentEnv,
	basin: BasinConfig,
	username: string,
): Promise<GuestTotals | undefined> {
	const videos = await cachedJson("videos", async () => {
		const data = await queryGateway<unknown>(env, GUEST_SCOPE_QUERY);
		const parsed = parseAcademyVideos(data);
		if (!parsed) throw new Error("Academy video list unusable");
		return parsed;
	});
	const mine = visibleEpisodes(videos, username);
	if (mine.length === 0) return undefined;

	const lake = await cachedJson<LakeVideo[]>("lake", async () =>
		(await basinQuery(basin, lakeCatalogueSql, { ttlSeconds: CACHE_SECONDS }))
			.flatMap((row) =>
				typeof row.video === "string" && typeof row.title === "string"
					? [{ video: row.video, title: row.title }]
					: [],
			),
	);
	const ids = youtubeIds(videos, lake);
	const tracked = [
		...new Set(
			mine.flatMap((episode) => {
				const id = ids.get(episode.id);
				return id && videoIdPattern.test(id) ? [id] : [];
			}),
		),
	];
	const totals = {
		episodes: mine.length,
		withoutNumbers: mine.filter((episode) => !ids.has(episode.id)).length,
		views: { d90: 0, lifetime: 0 },
		minutes: { d90: 0, lifetime: 0 },
	};
	if (tracked.length === 0) return totals;
	const [row] = await basinQuery(
		basin,
		guestTotalsSql(tracked, reachWindow()),
		{ ttlSeconds: 1800 },
	);
	totals.views = { d90: num(row?.views_d90), lifetime: num(row?.views_lifetime) };
	totals.minutes = {
		d90: num(row?.minutes_d90),
		lifetime: num(row?.minutes_lifetime),
	};
	return totals;
}
