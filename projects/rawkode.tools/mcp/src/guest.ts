import { z } from "zod";
import { basinQuery, type BasinConfig, type Row } from "./basin.ts";
import { ensure, readLimited, ServiceError } from "./errors.ts";
import {
  dailySql, GUEST_SCOPE_QUERY, lakeCatalogueSql, normalizeHandle, normalizeTitle, videoIdPattern, visibleEpisodes, youtubeIds,
  type AcademyVideo, type EpisodeAccess, type LakeVideo, type Role,
} from "../../../../packages/guest-scope/index.ts";

// The scoping rules and the lake queries are shared with the website's
// /analytics page: packages/guest-scope.
export { lakeCatalogueSql, normalizeHandle, normalizeTitle, visibleEpisodes, youtubeIds };
export type { AcademyVideo, EpisodeAccess, LakeVideo, Role };

// What a guest may see is derived, never hand-listed: the Academy's public
// GraphQL API says who guested on (or hosts the show of) which video, and the
// analytics lake's `youtube.video` catalogue says which YouTube video that is.
// A video that can't be tied to one YouTube video with certainty is left out.
export const ACADEMY_API = "https://api.rawkode.academy/";

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

export async function fetchAcademyVideos(fetcher: typeof fetch = (...args) => fetch(...args)): Promise<AcademyVideo[]> {
  const answer = await fetcher(ACADEMY_API, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(20000),
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: GUEST_SCOPE_QUERY }),
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

export async function fetchLakeCatalogue(basin: BasinConfig): Promise<LakeVideo[]> {
  const { rows } = await basinQuery(basin, lakeCatalogueSql, 10000);
  return rows.filter((row: Row): row is Row & { video: string; title: string } => typeof row.video === "string" && typeof row.title === "string")
    .map(row => ({ video: row.video, title: row.title }));
}

// Video IDs are 11 URL-safe characters, so they are safe to inline.
export function guestDailySql(videoIds: readonly string[], startDate: string, endDate: string) {
  ensure(videoIds.length > 0 && videoIds.every(id => videoIdPattern.test(id)), "invalid_input", "Expected YouTube video IDs");
  return dailySql(videoIds, startDate, endDate);
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
