import { ensure, readLimited, ServiceError } from "./domain.ts";
import { type AcademyVideo, https } from "./render.ts";

type Gateway = { fetch: typeof fetch };
type Credited = { id?: string; name?: string; twitterUrl?: string | null; blueskyUrl?: string | null; linkedinUrl?: string | null };

const person = (g: Credited | undefined) => g?.id && g.name ? [{ id: g.id, name: g.name, x: https(g.twitterUrl, "https://x.com/"), bluesky: https(g.blueskyUrl, "https://bsky.app/profile/"), linkedin: https(g.linkedinUrl, "https://www.linkedin.com/in/") }] : [];

async function graphql<T>(service: Gateway, url: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await service.fetch(url, { method: "POST", signal: AbortSignal.timeout(30000), redirect: "manual", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query, variables }) });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ServiceError("academy_api_error", `Academy API request failed (HTTP ${response.status})`, 502, response.status);
  }
  let page: { data?: T; errors?: unknown[] };
  try { page = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 16 * 1024 * 1024))); }
  catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError("invalid_academy_response", "Academy API returned invalid JSON", 502); }
  ensure(!page.errors?.length && page.data, "invalid_academy_response", "Academy API returned errors or no data", 502);
  return page.data;
}

const VIDEO_FIELDS = "id title slug description thumbnailUrl chapters { startTime title } collaborators { name announcement announcementUrl } episode { show { id name } } castingCredits { role person { id name twitterUrl blueskyUrl linkedinUrl } } technologies { id name website community { twitter bluesky mastodon youtube } }";
type ListedVideo = { id?: string; title?: string; slug?: string; description?: string; thumbnailUrl?: string; chapters?: { startTime?: number; title?: string }[]; collaborators?: { name?: string; announcement?: string | null; announcementUrl?: string | null }[]; episode?: { show?: { id?: string; name?: string } | null } | null; castingCredits?: { role?: string; person?: Credited }[]; technologies?: { id?: string; name?: string; website?: string | null; community?: { twitter?: string | null; bluesky?: string | null; mastodon?: string | null; youtube?: string | null } | null }[] };

function toAcademyVideo(video: ListedVideo, courseByVideo: Map<string, string>): AcademyVideo | undefined {
  if (typeof video.id !== "string" || typeof video.title !== "string" || typeof video.slug !== "string") return undefined;
  return { id: video.id, title: video.title, slug: video.slug, collaborators: (video.collaborators ?? []).map(c => String(c.name ?? "")).filter(Boolean),
      announcements: (video.collaborators ?? []).flatMap(c => c.name && c.announcement?.trim() ? [{ name: c.name, text: c.announcement.trim(), ...(c.announcementUrl && /^https:\/\//.test(c.announcementUrl) ? { url: c.announcementUrl } : {}) }] : []),
      description: typeof video.description === "string" ? video.description : "",
      chapters: (video.chapters ?? []).flatMap(c => typeof c.startTime === "number" && typeof c.title === "string" ? [{ startTime: c.startTime, title: c.title }] : []),
      thumbnailUrl: typeof video.thumbnailUrl === "string" ? video.thumbnailUrl : "",
      course: courseByVideo.get(video.id) ?? null,
      show: video.episode?.show?.id && video.episode.show.name ? { id: video.episode.show.id, name: video.episode.show.name } : null,
      // Casting credits decide who is listed.
      hosts: (video.castingCredits ?? []).filter(c => c.role === "HOST" || c.role === "CO_HOST").flatMap(c => person(c.person)),
      guests: (video.castingCredits ?? []).filter(c => c.role === "GUEST").flatMap(c => person(c.person)),
      technologies: (video.technologies ?? []).flatMap(t => t.id && t.name ? [{ id: t.id, name: t.name, website: https(t.website), x: https(t.community?.twitter, "https://x.com/"), bluesky: https(t.community?.bluesky, "https://bsky.app/profile/"), mastodon: https(t.community?.mastodon), youtube: https(t.community?.youtube, "https://youtube.com/@") }] : []) };
}

// Every YouTube ID the Academy maps to a video, and the listed Academy video
// behind it. Course-only videos are not in getAllVideos' default result, so
// they are mapped but have no Academy video here, and the plan skips them.
export async function fetchCatalogue(env: { VIDEO_CHANNELS: Gateway; ACADEMY_API: Gateway }): Promise<Map<string, AcademyVideo | undefined>> {
  const mappings = await graphql<{ videoChannels?: { videoId?: string; externalId?: string }[] }>(env.VIDEO_CHANNELS, "https://video-channels/", "{ videoChannels(platform: YOUTUBE) { videoId externalId } }");
  const byAcademyId = new Map<string, string>();
  for (const row of mappings.videoChannels ?? []) if (typeof row.videoId === "string" && typeof row.externalId === "string" && /^[A-Za-z0-9_-]{11}$/.test(row.externalId)) byAcademyId.set(row.videoId, row.externalId);
  ensure(byAcademyId.size > 0, "invalid_academy_response", "video-channels returned no YouTube IDs", 502);
  const all = await graphql<{ getAllVideos?: ListedVideo[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", `{ getAllVideos { ${VIDEO_FIELDS} } }`);
  const courses = await graphql<{ allCourses?: { title?: string; modules?: { video?: { id?: string } | null }[] }[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", "{ allCourses { title modules { video { id } } } }");
  const courseByVideo = new Map<string, string>();
  for (const course of courses.allCourses ?? []) for (const lesson of course.modules ?? []) if (course.title && lesson.video?.id && !courseByVideo.has(lesson.video.id)) courseByVideo.set(lesson.video.id, course.title);
  ensure(all.getAllVideos?.length, "invalid_academy_response", "The Academy API returned no videos", 502);
  const listed = new Map<string, AcademyVideo>();
  for (const video of all.getAllVideos ?? []) {
    const mapped = toAcademyVideo(video, courseByVideo);
    if (mapped) listed.set(mapped.id, mapped);
  }
  return new Map([...byAcademyId].map(([academyId, youtubeId]) => [youtubeId, listed.get(academyId)]));
}

// One video, for a push after the site changed it: its YouTube ID and listed
// Academy video. Null when it has no YouTube mapping; the video is undefined
// when the site doesn't list it (course-only or unpublished).
export async function fetchVideo(env: { VIDEO_CHANNELS: Gateway; ACADEMY_API: Gateway }, videoId: string): Promise<{ youtubeId: string; video: AcademyVideo | undefined } | null> {
  const mappings = await graphql<{ videoChannels?: { videoId?: string; externalId?: string }[] }>(env.VIDEO_CHANNELS, "https://video-channels/", "{ videoChannels(platform: YOUTUBE) { videoId externalId } }");
  const youtubeId = (mappings.videoChannels ?? []).find(row => row.videoId === videoId)?.externalId;
  if (typeof youtubeId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) return null;
  const one = await graphql<{ videoByID?: ListedVideo | null }>(env.ACADEMY_API, "https://api.rawkode.academy/", `query ($id: String!) { videoByID(id: $id) { ${VIDEO_FIELDS} } }`, { id: videoId });
  const courses = await graphql<{ allCourses?: { title?: string; modules?: { video?: { id?: string } | null }[] }[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", "{ allCourses { title modules { video { id } } } }");
  const courseByVideo = new Map<string, string>();
  for (const course of courses.allCourses ?? []) for (const lesson of course.modules ?? []) if (course.title && lesson.video?.id && !courseByVideo.has(lesson.video.id)) courseByVideo.set(lesson.video.id, course.title);
  return { youtubeId, video: one.videoByID ? toAcademyVideo(one.videoByID, courseByVideo) : undefined };
}

// A video that has no YouTube mapping yet: the site's copy and when it goes live. Null when the site doesn't list it.
export async function fetchScheduled(env: { ACADEMY_API: Gateway }, videoId: string): Promise<{ video: AcademyVideo; startsAt: string } | null> {
  const one = await graphql<{ videoByID?: (ListedVideo & { publishedAt?: string }) | null }>(env.ACADEMY_API, "https://api.rawkode.academy/", `query ($id: String!) { videoByID(id: $id) { ${VIDEO_FIELDS} publishedAt } }`, { id: videoId });
  const listed = one.videoByID;
  const video = listed ? toAcademyVideo(listed, new Map()) : undefined;
  const startsAt = listed?.publishedAt ? new Date(listed.publishedAt).toISOString() : undefined;
  return video && startsAt ? { video, startsAt } : null;
}
