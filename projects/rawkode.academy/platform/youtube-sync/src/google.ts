import { ensure, readLimited, ServiceError } from "./domain.ts";
import { type Snippet, writableSnippet } from "./render.ts";

type Query = Record<string, string | number | boolean | undefined>;
// Reasons YouTube gives for a 403 that means "wait for the quota to reset".
const QUOTA_REASONS = new Set(["quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"]);
const dataAPI = "https://www.googleapis.com/youtube/v3/";

// Write access to one channel's video metadata (youtube.force-ssl) using a
// stored offline refresh token. Separate from the read-only analytics grant.
export type GoogleCredentials = { clientId?: string; clientSecret?: string; refreshToken?: string };

export const CONSENT_TASK = "cuenv task consent (in projects/rawkode.academy/platform/youtube-sync)";

export class GoogleClient {
  private token?: string;
  constructor(private credentials: GoogleCredentials, public channelId: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  private async authorize() {
    if (this.token) return;
    const { clientId, clientSecret, refreshToken } = this.credentials;
    ensure([clientId, clientSecret, refreshToken].every(value => typeof value === "string" && value.length > 0), "reauthorization_required", `YouTube authorization is missing. Run ${CONSENT_TASK}.`, 503);
    const response = await this.fetcher("https://oauth2.googleapis.com/token", {
      method: "POST", signal: AbortSignal.timeout(20000), redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: clientId!, client_secret: clientSecret!, refresh_token: refreshToken! }),
    });
    if (response.status === 400 || response.status === 401) {
      // Google's OAuth error codes are fixed identifiers, never secrets.
      let code = "unknown";
      try { const body = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 4096))); if (typeof body?.error === "string" && /^[a-z_]{1,64}$/.test(body.error)) code = body.error; } catch { /* keep "unknown" */ }
      throw new ServiceError("reauthorization_required", `Google rejected the stored YouTube authorization (${code}). Run ${CONSENT_TASK}.`, 401, response.status);
    }
    const value = await this.decode<{ access_token?: string }>(response, "oauth_refresh", 65536);
    ensure(typeof value.access_token === "string" && value.access_token.length > 0, "oauth_refresh", "Google authorization returned no access token", 502);
    this.token = value.access_token;
  }
  private async decode<T>(response: Response, operation: string, max = 4 * 1024 * 1024): Promise<T> {
    // No response bodies or OAuth values in errors or logs.
    if (!response.ok) {
      // Only the fixed reason identifier is read, never the message.
      let reason = "";
      try { const body = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 8192))); const first = body?.error?.errors?.[0]?.reason; if (typeof first === "string" && /^[A-Za-z]{1,64}$/.test(first)) reason = first; } catch { /* keep "" */ }
      const quota = response.status === 403 && QUOTA_REASONS.has(reason);
      throw new ServiceError(quota ? "quota_exceeded" : "google_api_error", `${operation} failed (HTTP ${response.status}${quota ? ", quota exhausted" : ""}); check access, quota and API configuration`, 502, response.status);
    }
    try { return JSON.parse(new TextDecoder().decode(await readLimited(response.body, max))) as T; }
    catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError("invalid_google_response", `${operation} returned invalid JSON`, 502); }
  }
  private async get<T>(base: string, resource: string, query: Query = {}): Promise<T> {
    const url = new URL(resource, base);
    await this.authorize();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await this.fetcher(url, { method: "GET", signal: AbortSignal.timeout(20000), redirect: "manual", headers: { authorization: `Bearer ${this.token}` } });
    return this.decode<T>(response, `GET ${resource}`);
  }
  private async send<T>(method: "PUT" | "POST", base: string, resource: string, query: Query, body: BodyInit, headers: Record<string, string>): Promise<T> {
    const url = new URL(resource, base);
    await this.authorize();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    const response = await this.fetcher(url, { method, signal: AbortSignal.timeout(30000), redirect: "manual", headers: { authorization: `Bearer ${this.token}`, ...headers }, body });
    return this.decode<T>(response, `${method} ${resource}`);
  }
  async checkChannel() {
    const result = await this.get<{ items?: { id: string }[]; nextPageToken?: string }>(dataAPI, "channels", { part: "id", mine: true, maxResults: 50 });
    // The grant must identify exactly the configured YouTube/Brand channel.
    ensure(result.items?.length === 1 && result.items[0].id === this.channelId && !result.nextPageToken, "wrong_channel", "Authorize the configured YouTube/Brand channel directly; Google must identify exactly that channel", 403);
  }
  // Live snippets, up to 50 per call (1 quota unit). Videos YouTube doesn't
  // return (private, deleted) are absent from the map.
  async listSnippets(ids: string[]): Promise<Map<string, Snippet>> {
    ensure(ids.length > 0 && ids.length <= 50, "invalid_input", "videos.list takes 1 to 50 IDs");
    const result = await this.get<{ items?: { id?: string; snippet?: Partial<Snippet> }[] }>(dataAPI, "videos", { part: "snippet", id: ids.join(","), maxResults: 50 });
    const map = new Map<string, Snippet>();
    for (const item of result.items ?? []) if (typeof item.id === "string" && item.snippet) map.set(item.id, writableSnippet(item.snippet));
    return map;
  }
  // videos.update replaces the whole snippet (50 quota units): callers pass the
  // complete live snippet with only managed fields changed.
  async updateSnippet(id: string, snippet: Snippet): Promise<void> {
    ensure(snippet.title && snippet.categoryId, "invalid_input", "A snippet update needs the live title and categoryId; refusing to send a partial snippet");
    await this.send("PUT", dataAPI, "videos", { part: "snippet" }, JSON.stringify({ id, snippet }), { "content-type": "application/json" });
  }
  // Uploads a JPEG or PNG (up to 2 MB) as the video's custom thumbnail (50 quota units).
  async setThumbnail(id: string, image: Uint8Array): Promise<void> {
    ensure(image.byteLength > 0 && image.byteLength <= 2 * 1024 * 1024, "invalid_input", "A thumbnail must be 1 byte to 2 MB");
    await this.send("POST", "https://www.googleapis.com/upload/youtube/v3/", "thumbnails/set", { videoId: id, uploadType: "media" }, image, { "content-type": "image/jpeg" });
  }

  // Schedules a live broadcast (50 quota units). Auto-start and auto-stop are on and latency is ultra low.
  async insertBroadcast(input: { title: string; description: string; scheduledStartTime: string; privacy: "public" | "unlisted" | "private" }): Promise<string> {
    ensure(input.title && input.scheduledStartTime, "invalid_input", "A broadcast needs a title and a start time");
    const body = { snippet: { title: input.title, description: input.description, scheduledStartTime: input.scheduledStartTime }, status: { privacyStatus: input.privacy, selfDeclaredMadeForKids: false }, contentDetails: { enableAutoStart: true, enableAutoStop: true, latencyPreference: "ultraLow", monitorStream: { enableMonitorStream: false } } };
    const result = await this.send<{ id?: string }>("POST", dataAPI, "liveBroadcasts", { part: "snippet,status,contentDetails" }, JSON.stringify(body), { "content-type": "application/json" });
    ensure(typeof result.id === "string" && /^[A-Za-z0-9_-]{11}$/.test(result.id), "invalid_google_response", "liveBroadcasts.insert returned no broadcast id", 502);
    return result.id;
  }
  // The reusable stream (stream key) the broadcast goes out on: the configured one, else the first reusable stream (1 quota unit).
  async findStream(preferred?: string): Promise<string | null> {
    const result = await this.get<{ items?: { id?: string; cdn?: { resolution?: string }; contentDetails?: { isReusable?: boolean } }[] }>(dataAPI, "liveStreams", { part: "id,contentDetails,cdn", mine: true, maxResults: 50 });
    const streams = (result.items ?? []).filter(item => typeof item.id === "string");
    return (preferred ? streams.find(item => item.id === preferred) : undefined)?.id ?? streams.find(item => item.contentDetails?.isReusable)?.id ?? null;
  }
  // Binds a broadcast to a stream (50 quota units).
  async bindBroadcast(broadcastId: string, streamId: string): Promise<void> {
    await this.send("POST", dataAPI, "liveBroadcasts/bind", { id: broadcastId, part: "id", streamId }, "", {});
  }
}
