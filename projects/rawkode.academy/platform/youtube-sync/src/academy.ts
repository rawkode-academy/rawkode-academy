import { ensure, readLimited, ServiceError } from "./domain.ts";
import { type AcademyVideo, https } from "./render.ts";

type Gateway = { fetch: typeof fetch };
type Credited = { id?: string; name?: string; twitterUrl?: string | null; blueskyUrl?: string | null; linkedinUrl?: string | null };

const person = (g: Credited | undefined) => g?.id && g.name ? [{ id: g.id, name: g.name, x: https(g.twitterUrl, "https://x.com/"), bluesky: https(g.blueskyUrl, "https://bsky.app/profile/"), linkedin: https(g.linkedinUrl, "https://www.linkedin.com/in/") }] : [];

async function graphql<T>(service: Gateway, url: string, query: string): Promise<T> {
  const response = await service.fetch(url, { method: "POST", signal: AbortSignal.timeout(30000), redirect: "manual", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ query }) });
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

// Every YouTube ID the Academy maps to a video, and the listed Academy video
// behind it. Course-only videos are not in getAllVideos' default result, so
// they are mapped but have no Academy video here, and the plan skips them.
export async function fetchCatalogue(env: { VIDEO_CHANNELS: Gateway; ACADEMY_API: Gateway }): Promise<Map<string, AcademyVideo | undefined>> {
  const mappings = await graphql<{ videoChannels?: { videoId?: string; externalId?: string }[] }>(env.VIDEO_CHANNELS, "https://video-channels/", "{ videoChannels(platform: YOUTUBE) { videoId externalId } }");
  const byAcademyId = new Map<string, string>();
  for (const row of mappings.videoChannels ?? []) if (typeof row.videoId === "string" && typeof row.externalId === "string" && /^[A-Za-z0-9_-]{11}$/.test(row.externalId)) byAcademyId.set(row.videoId, row.externalId);
  ensure(byAcademyId.size > 0, "invalid_academy_response", "video-channels returned no YouTube IDs", 502);
  const all = await graphql<{ getAllVideos?: { id?: string; title?: string; slug?: string; description?: string; thumbnailUrl?: string; chapters?: { startTime?: number; title?: string }[]; collaborators?: { name?: string }[]; episode?: { show?: { id?: string; name?: string } | null } | null; guests?: Credited[]; castingCredits?: { role?: string; person?: Credited }[]; technologies?: { id?: string; name?: string; website?: string | null; community?: { twitter?: string | null; bluesky?: string | null; mastodon?: string | null; youtube?: string | null } | null }[] }[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", "{ getAllVideos { id title slug description thumbnailUrl chapters { startTime title } collaborators { name } episode { show { id name } } guests { id name twitterUrl blueskyUrl linkedinUrl } castingCredits { role person { id name twitterUrl blueskyUrl linkedinUrl } } technologies { id name website community { twitter bluesky mastodon youtube } } } }");
  const courses = await graphql<{ allCourses?: { title?: string; modules?: { video?: { id?: string } | null }[] }[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", "{ allCourses { title modules { video { id } } } }");
  const courseByVideo = new Map<string, string>();
  for (const course of courses.allCourses ?? []) for (const lesson of course.modules ?? []) if (course.title && lesson.video?.id && !courseByVideo.has(lesson.video.id)) courseByVideo.set(lesson.video.id, course.title);
  ensure(all.getAllVideos?.length, "invalid_academy_response", "The Academy API returned no videos", 502);
  const listed = new Map<string, AcademyVideo>();
  for (const video of all.getAllVideos ?? []) {
    if (typeof video.id !== "string" || typeof video.title !== "string" || typeof video.slug !== "string") continue;
    listed.set(video.id, { id: video.id, title: video.title, slug: video.slug, collaborators: (video.collaborators ?? []).map(c => String(c.name ?? "")).filter(Boolean),
      description: typeof video.description === "string" ? video.description : "",
      chapters: (video.chapters ?? []).flatMap(c => typeof c.startTime === "number" && typeof c.title === "string" ? [{ startTime: c.startTime, title: c.title }] : []),
      thumbnailUrl: typeof video.thumbnailUrl === "string" ? video.thumbnailUrl : "",
      course: courseByVideo.get(video.id) ?? null,
      show: video.episode?.show?.id && video.episode.show.name ? { id: video.episode.show.id, name: video.episode.show.name } : null,
      // Explicit casting credits decide who is listed; a video without any keeps its legacy guests and lists no hosts.
      hosts: (video.castingCredits ?? []).filter(c => c.role === "HOST" || c.role === "CO_HOST").flatMap(c => person(c.person)),
      guests: video.castingCredits?.length ? video.castingCredits.filter(c => c.role === "GUEST").flatMap(c => person(c.person)) : (video.guests ?? []).flatMap(g => person(g)),
      technologies: (video.technologies ?? []).flatMap(t => t.id && t.name ? [{ id: t.id, name: t.name, website: https(t.website), x: https(t.community?.twitter, "https://x.com/"), bluesky: https(t.community?.bluesky, "https://bsky.app/profile/"), mastodon: https(t.community?.mastodon), youtube: https(t.community?.youtube, "https://youtube.com/@") }] : []) });
  }
  return new Map([...byAcademyId].map(([academyId, youtubeId]) => [youtubeId, listed.get(academyId)]));
}
