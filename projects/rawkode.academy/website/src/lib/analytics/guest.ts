// A signed-in guest's (or show host's) own YouTube totals for /analytics: the
// episodes they appear in, summed over 90 days and lifetime. Who sees which
// episode is decided by packages/guest-scope, the same code the Rawkode Tools
// MCP uses, so both show a person the same episodes.
import {
	type AcademyVideo,
	dailySql,
	castFromCredits,
	GUEST_SCOPE_QUERY,
	visibleEpisodes,
	withCourseAuthors,
	youtubeIds,
} from "../../../../../../packages/guest-scope/index";
import type { Snapshot } from "@/lib/analytics/snapshot";
import type { ContentEnv } from "@/lib/live-content/env";
import { queryGateway } from "@/lib/live-content/gateway";
import { reachWindow, YOUTUBE_HISTORY_FROM } from "@/lib/analytics/reach";

export type GuestVideo = {
	title: string;
	slug: string;
	views: { d90: number; lifetime: number };
	minutes: { d90: number; lifetime: number };
};

export type GuestTotals = {
	episodes: number;
	/** Episodes that can't be tied to exactly one YouTube video: no numbers. */
	withoutNumbers: number;
	views: { d90: number; lifetime: number };
	minutes: { d90: number; lifetime: number };
	/** Episodes with numbers, most viewed over their lifetime first. */
	videos: GuestVideo[];
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
	const courses = (data as { allCourses?: unknown }).allCourses;
	if (!Array.isArray(courses)) return undefined;
	const scope = courses.map((course: Record<string, unknown>) => ({
		authors: people(course?.authors),
		videoIds: (Array.isArray(course?.modules) ? course.modules : []).flatMap(
			(module: { video?: { id?: unknown } | null }) => {
				const id = text(module?.video?.id);
				return id ? [id] : [];
			},
		),
	}));
	const parsed = videos.flatMap((video: Record<string, unknown>) => {
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
				...castFromCredits(
					(Array.isArray(video.castingCredits) ? video.castingCredits : []).flatMap(
						(credit: { role?: unknown; person?: unknown }) => {
							const [person] = people([credit?.person]);
							const role = text(credit?.role);
							return person && role ? [{ role, person }] : [];
						},
					),
					{ guests: people(video.guests), hosts: people(show?.hosts) },
				),
			},
		];
	});
	return withCourseAuthors(parsed, scope);
}

/** One row per video: views and minutes watched over 90 days and lifetime. */
export function guestVideosSql(
	videoIds: readonly string[],
	window: ReturnType<typeof reachWindow>,
) {
	return `SELECT
	video,
	sum(CASE WHEN day >= '${window.youtubeD90}' THEN views ELSE 0 END) AS views_d90,
	sum(views) AS views_lifetime,
	sum(CASE WHEN day >= '${window.youtubeD90}' THEN minutes_watched ELSE 0 END) AS minutes_d90,
	sum(minutes_watched) AS minutes_lifetime
FROM (${dailySql(videoIds, YOUTUBE_HISTORY_FROM, window.youtubeEnd)})
GROUP BY video`;
}

/**
 * undefined when there is nothing to show (not a guest or host). Per-video
 * numbers come from the daily snapshot; only the Academy video list (and so
 * who counts as a guest or host) is read live. Throws if that list can't be read.
 */
export async function guestTotals(
	env: ContentEnv,
	snapshot: Snapshot,
	username: string,
): Promise<GuestTotals | undefined> {
	const data = await queryGateway<unknown>(env, GUEST_SCOPE_QUERY);
	const videos = parseAcademyVideos(data);
	if (!videos) throw new Error("Academy video list unusable");
	const mine = visibleEpisodes(videos, username);
	if (mine.length === 0) return undefined;

	const ids = youtubeIds(videos, snapshot.lake);
	const totals: GuestTotals = {
		episodes: mine.length,
		withoutNumbers: mine.filter((episode) => !ids.has(episode.id)).length,
		views: { d90: 0, lifetime: 0 },
		minutes: { d90: 0, lifetime: 0 },
		videos: [],
	};
	const seen = new Set<string>();
	for (const episode of mine) {
		const youtube = ids.get(episode.id);
		const stats = youtube ? snapshot.videos[youtube] : undefined;
		// Two Academy videos never share a YouTube video, but count it once if they do.
		if (!youtube || !stats || seen.has(youtube)) continue;
		seen.add(youtube);
		const video: GuestVideo = {
			title: episode.title,
			slug: episode.slug,
			views: stats.views,
			minutes: stats.minutes,
		};
		totals.videos.push(video);
		totals.views.d90 += video.views.d90;
		totals.views.lifetime += video.views.lifetime;
		totals.minutes.d90 += video.minutes.d90;
		totals.minutes.lifetime += video.minutes.lifetime;
	}
	totals.videos.sort((a, b) => b.views.lifetime - a.views.lifetime);
	return totals;
}
