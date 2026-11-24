import { ensure, readLimited, ServiceError } from "./domain.ts";

// A video whose stats the channel collects. The ID is the YouTube video ID.
export type Video = { videoId: string; title: string; publishedAt: string | null };
type Gateway = { fetch: typeof fetch };

async function graphql<T>(service: Gateway, url: string, query: string): Promise<T> {
  const response = await service.fetch(url, {
    method: "POST", signal: AbortSignal.timeout(20000), redirect: "manual",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ServiceError("academy_api_error", `Academy API request failed (HTTP ${response.status})`, 502, response.status);
  }
  let page: { data?: T; errors?: unknown[] };
  try { page = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 8 * 1024 * 1024))); }
  catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError("invalid_academy_response", "Academy API returned invalid JSON", 502); }
  ensure(!page.errors?.length && page.data, "invalid_academy_response", "Academy API returned errors or no data", 502);
  return page.data;
}

// The videos to collect: every YouTube ID in video-channels (the Academy's own
// mapping, which includes course module videos that are not Video entities).
// YouTube-only uploads with no Academy page (clips, intros, old series) are not
// collected. `publishedAt` is null: the Academy date can be later than the
// upload, and a report for a day before a video existed simply has no rows.
export async function fetchVideos(env: { VIDEO_CHANNELS: Gateway; ACADEMY_API: Gateway }): Promise<Video[]> {
  const mappings = await graphql<{ videoChannels?: { videoId?: string; externalId?: string }[] }>(env.VIDEO_CHANNELS, "https://video-channels/", "{ videoChannels(platform: YOUTUBE) { videoId externalId } }");
  const ids = new Map<string, string>();
  for (const row of mappings.videoChannels ?? []) {
    if (typeof row.videoId === "string" && typeof row.externalId === "string" && /^[A-Za-z0-9_-]{11}$/.test(row.externalId)) ids.set(row.externalId, row.videoId);
  }
  // An empty list would silently stop all per-video collection: fail the step so
  // it is retried and alerts.
  ensure(ids.size > 0, "invalid_academy_response", "video-channels returned no YouTube IDs", 502);

  // Titles for the catalogue are best effort. A video without one (a course
  // module video) is still collected; its title is blank.
  const titles = new Map<string, string>();
  try {
    const all = await graphql<{ getAllVideos?: { id?: string; title?: string }[] }>(env.ACADEMY_API, "https://api.rawkode.academy/", "{ getAllVideos { id title } }");
    for (const video of all.getAllVideos ?? []) if (typeof video.id === "string") titles.set(video.id, String(video.title ?? ""));
  } catch (error) {
    console.error(JSON.stringify({ operation: "academy_titles", error: error instanceof ServiceError ? error.code : "unknown" }));
  }
  return [...ids].map(([videoId, academyId]) => ({ videoId, title: (titles.get(academyId) ?? "").slice(0, 300), publishedAt: null }));
}
