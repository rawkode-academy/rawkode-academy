import { ensure, readLimited, ServiceError } from "./domain.ts";

// A video whose stats the channel collects. The ID is the YouTube video ID.
export type Video = { videoId: string; title: string; publishedAt: string | null };

type Page = { data?: { getAllVideos?: { id?: string; title?: string; channels?: { platform?: string; externalId?: string }[] }[] }; errors?: unknown[] };

const query = "{ getAllVideos { id title channels { platform externalId } } }";

// The videos to collect: every Academy video that has a YouTube ID in
// video-channels, read through the GraphQL gateway. The Academy's own IDs are the
// source of truth, so YouTube-only uploads (clips, trailers, old streams) are not
// collected. `publishedAt` is null: the Academy date can be later than the
// upload, and a report for a day before a video existed simply has no rows.
export async function fetchVideos(gateway: { fetch: typeof fetch }): Promise<Video[]> {
  const response = await gateway.fetch("https://api.rawkode.academy/", {
    method: "POST", signal: AbortSignal.timeout(20000), redirect: "manual",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new ServiceError("academy_api_error", `Academy API request failed (HTTP ${response.status})`, 502, response.status);
  }
  let page: Page;
  try { page = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 8 * 1024 * 1024))) as Page; }
  catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError("invalid_academy_response", "Academy API returned invalid JSON", 502); }
  ensure(!page.errors?.length && Array.isArray(page.data?.getAllVideos), "invalid_academy_response", "Academy API returned errors or no video list", 502);
  const videos = new Map<string, Video>();
  for (const video of page.data!.getAllVideos!) {
    for (const channel of video.channels ?? []) {
      if (channel.platform !== "YOUTUBE" || typeof channel.externalId !== "string" || !/^[A-Za-z0-9_-]{11}$/.test(channel.externalId)) continue;
      videos.set(channel.externalId, { videoId: channel.externalId, title: String(video.title ?? "").slice(0, 300), publishedAt: null });
    }
  }
  // An empty list would silently stop all per-video collection (e.g. the gateway
  // composed without video-channels): fail the step so it is retried and alerts.
  ensure(videos.size > 0, "invalid_academy_response", "The Academy API returned no videos with a YouTube ID", 502);
  return [...videos.values()];
}
