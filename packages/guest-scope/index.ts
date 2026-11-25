// Who may see which episode's numbers, and how to read them from the lake.
// Shared by the Rawkode Tools MCP and the website's /analytics page so that a
// guest sees the same episodes in both. No imports: both bundle this file
// directly (there is deliberately no package.json), and each validates its
// own inputs and handles its own errors.

// The Academy's public GraphQL API says who guested on (or hosts the show of)
// which video; the analytics lake's `youtube.video` catalogue says which
// YouTube video that is. A video that can't be tied to one YouTube video with
// certainty is left out.
export const GUEST_SCOPE_QUERY = `query GuestScope { getAllVideos(includeCourseVideos: true) { id title slug publishedAt youtubeId guests { id githubHandle } episode { show { id hosts { id githubHandle } } } } }`;

export type Role = "guest" | "host";
export type Person = { id: string; githubHandle: string | null };
export type AcademyVideo = { id: string; title: string; slug: string; publishedAt: string | null; youtubeId: string | null; show: string | null; guests: Person[]; hosts: Person[] };
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

export const videoIdPattern = /^[A-Za-z0-9_-]{11}$/;
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

export const lakeCatalogueSql = `SELECT video, title FROM (
	SELECT
		json_get_str(value, 'data', 'video') AS video,
		json_get_str(value, 'data', 'title') AS title,
		ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'video') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
	FROM analytics.events_archive
	WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.video'
) WHERE rn = 1`;

// One row per video and day, keeping the latest fetch of each. The caller
// must pass only YouTube video IDs it has already checked against
// videoIdPattern: they are inlined into the SQL.
export function dailySql(videoIds: readonly string[], startDate: string, endDate: string) {
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
