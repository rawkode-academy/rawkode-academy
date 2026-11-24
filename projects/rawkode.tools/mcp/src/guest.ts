import { z } from "zod";
import { basinQuery, type BasinConfig, type Row } from "./basin.ts";
import { ensure, readLimited, ServiceError } from "./errors.ts";

// What a guest may see is derived, never hand-listed: the Academy's public
// GraphQL API says who guested on (or hosts the show of) which video, and the
// analytics lake's `youtube.video` catalogue says which YouTube video that is.
// A video that can't be tied to one YouTube video with certainty is left out.
export const ACADEMY_API = "https://api.rawkode.academy/";

const QUERY = `query GuestScope { getAllVideos(includeCourseVideos: true) { id title slug publishedAt youtubeId guests { id githubHandle } episode { show { id hosts { id githubHandle } } } } }`;

const person = z.object({ id: z.string(), githubHandle: z.string().nullable().optional() });
const response = z.object({
  data: z.object({
    getAllVideos: z.array(z.object({
      id: z.string(), title: z.string(), slug: z.string(), publishedAt: z.union([z.string(), z.number()]).nullable().optional(),
      youtubeId: z.string().nullable().optional(),
      guests: z.array(person),
      episode: z.object({ show: z.object({ id: z.string(), hosts: z.array(person) }) }).nullable().optional(),
    })),
  }),
});

export type Role = "guest" | "host";
export type AcademyVideo = { id: string; title: string; slug: string; publishedAt: string | null; youtubeId: string | null; show: string | null; guests: Person[]; hosts: Person[] };
type Person = { id: string; githubHandle: string | null };
export type EpisodeAccess = Omit<AcademyVideo, "guests" | "hosts"> & { role: Role };
export type LakeVideo = { video: string; title: string };

// The rule the Academy used to match a GitHub username to a person id.
export function normalizeHandle(handle: string) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const isPerson = (candidate: Person, handle: string) =>
  handle !== "" && (candidate.id === handle || normalizeHandle(candidate.githubHandle ?? "") === handle);

// Guests of a video see it; hosts of a show see every episode of it.
export function visibleEpisodes(videos: readonly AcademyVideo[], username: string): EpisodeAccess[] {
  const handle = normalizeHandle(username);
  const found: EpisodeAccess[] = [];
  for (const { guests, hosts, ...video } of videos) {
    const role: Role | undefined = guests.some(p => isPerson(p, handle)) ? "guest" : hosts.some(p => isPerson(p, handle)) ? "host" : undefined;
    if (role) found.push({ ...video, role });
  }
  return found;
}

const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
export const normalizeTitle = (title: string) =>
  title.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

// Academy video id -> YouTube video id. A YouTube ID stored on the Academy's
// video is used as is; otherwise the two titles must be equal once normalised
// and unique on both sides.
export function youtubeIds(videos: readonly AcademyVideo[], lake: readonly LakeVideo[]) {
  const mapped = new Map<string, string>();
  for (const video of videos) if (video.youtubeId && videoIdPattern.test(video.youtubeId)) mapped.set(video.id, video.youtubeId);
  const claimed = new Set(mapped.values());
  const count = <T>(items: readonly T[], key: (item: T) => string) => {
    const counts = new Map<string, number>();
    for (const item of items) counts.set(key(item), (counts.get(key(item)) ?? 0) + 1);
    return counts;
  };
  const academyTitles = count(videos, video => normalizeTitle(video.title));
  const lakeTitles = count(lake, video => normalizeTitle(video.title));
  const lakeByTitle = new Map(lake.map(video => [normalizeTitle(video.title), video.video] as const));
  for (const video of videos) {
    if (mapped.has(video.id)) continue;
    const title = normalizeTitle(video.title);
    const youtube = lakeByTitle.get(title);
    if (title && youtube && videoIdPattern.test(youtube) && academyTitles.get(title) === 1 && lakeTitles.get(title) === 1 && !claimed.has(youtube)) mapped.set(video.id, youtube);
  }
  return mapped;
}

export async function fetchAcademyVideos(fetcher: typeof fetch = (...args) => fetch(...args)): Promise<AcademyVideo[]> {
  const answer = await fetcher(ACADEMY_API, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: QUERY }),
  });
  let body: unknown;
  try { body = JSON.parse(new TextDecoder().decode(await readLimited(answer.body, 8 * 1024 * 1024))); } catch { body = null; }
  const parsed = response.safeParse(body);
  if (!answer.ok || !parsed.success) throw new ServiceError("academy_api_unavailable", "The Rawkode Academy video list could not be read; try again shortly", 502);
  return parsed.data.data.getAllVideos.map(video => ({
    id: video.id, title: video.title, slug: video.slug, youtubeId: video.youtubeId ?? null,
    publishedAt: video.publishedAt == null ? null : new Date(video.publishedAt).toISOString(),
    show: video.episode?.show.id ?? null,
    guests: video.guests.map(p => ({ id: p.id, githubHandle: p.githubHandle ?? null })),
    hosts: (video.episode?.show.hosts ?? []).map(p => ({ id: p.id, githubHandle: p.githubHandle ?? null })),
  }));
}

export const lakeCatalogueSql = `SELECT video, title FROM (
	SELECT
		json_get_str(value, 'data', 'video') AS video,
		json_get_str(value, 'data', 'title') AS title,
		ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'video') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.video'
) WHERE rn = 1`;

export async function fetchLakeCatalogue(basin: BasinConfig): Promise<LakeVideo[]> {
  const { rows } = await basinQuery(basin, lakeCatalogueSql, 10000);
  return rows.filter((row: Row): row is Row & { video: string; title: string } => typeof row.video === "string" && typeof row.title === "string")
    .map(row => ({ video: row.video, title: row.title }));
}

// Video IDs are 11 URL-safe characters, so they are safe to inline.
export function guestDailySql(videoIds: readonly string[], startDate: string, endDate: string) {
  ensure(videoIds.length > 0 && videoIds.every(id => videoIdPattern.test(id)), "invalid_input", "Expected YouTube video IDs");
  const list = videoIds.map(id => `'${id}'`).join(", ");
  return `SELECT video, day, views, minutes_watched, average_view_duration_seconds, average_view_percentage, likes, comments, shares, subscribers_gained, subscribers_lost
FROM (
	SELECT
		json_get_str(value, 'data', 'video') AS video,
		json_get_str(value, 'data', 'day') AS day,
		json_get_int(value, 'data', 'views') AS views,
		json_get_int(value, 'data', 'estimatedMinutesWatched') AS minutes_watched,
		json_get_int(value, 'data', 'averageViewDuration') AS average_view_duration_seconds,
		json_get_float(value, 'data', 'averageViewPercentage') AS average_view_percentage,
		CAST(json_as_text(value, 'data', 'likes') AS BIGINT) AS likes,
		CAST(json_as_text(value, 'data', 'comments') AS BIGINT) AS comments,
		CAST(json_as_text(value, 'data', 'shares') AS BIGINT) AS shares,
		CAST(json_as_text(value, 'data', 'subscribersGained') AS BIGINT) AS subscribers_gained,
		CAST(json_as_text(value, 'data', 'subscribersLost') AS BIGINT) AS subscribers_lost,
		ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'video'), json_get_str(value, 'data', 'day') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.video_daily'
		AND json_get_str(value, 'data', 'video') IN (${list})
		AND json_get_str(value, 'data', 'day') BETWEEN '${startDate}' AND '${endDate}'
) WHERE rn = 1
ORDER BY day, video`;
}

export type Episodes = { episodes: (EpisodeAccess & { youtubeVideoId: string | null })[]; unmatched: number };

// The Academy and lake lists are cached for five minutes per isolate.
const TTL = 5 * 60 * 1000;
type Cached<T> = { at: number; value: T };
let academyCache: Cached<AcademyVideo[]> | undefined;
let lakeCache: Cached<LakeVideo[]> | undefined;
async function cached<T>(slot: Cached<T> | undefined, now: number, load: () => Promise<T>): Promise<Cached<T>> {
  return slot && now - slot.at <= TTL ? slot : { at: now, value: await load() };
}
const academyVideos = async (now: number) => (academyCache = await cached(academyCache, now, () => fetchAcademyVideos())).value;
const lakeVideos = async (basin: BasinConfig, now: number) => (lakeCache = await cached(lakeCache, now, () => fetchLakeCatalogue(basin))).value;

// Whether anyone may sign in as this GitHub username without the operator
// role: they must be a guest of a video, or a host of a show, in the Academy's
// data. Nothing is assigned by hand.
export async function appearsInAcademy(username: string, now = Date.now()) {
  return visibleEpisodes(await academyVideos(now), username).length > 0;
}

// What this person may see, with each episode's YouTube video ID (null when it
// can't be tied to exactly one).
export async function episodesFor(username: string, basin: BasinConfig, now = Date.now()): Promise<Episodes> {
  const [videos, lake] = await Promise.all([academyVideos(now), lakeVideos(basin, now)]);
  const ids = youtubeIds(videos, lake);
  const episodes = visibleEpisodes(videos, username).map(episode => ({ ...episode, youtubeVideoId: ids.get(episode.id) ?? null }));
  return { episodes, unmatched: episodes.filter(episode => !episode.youtubeVideoId).length };
}
export const resetGuestCache = () => { academyCache = undefined; lakeCache = undefined; };
