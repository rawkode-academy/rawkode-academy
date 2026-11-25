import { ensure, readLimited, ServiceError } from "./domain.ts";

type Query = Record<string, string | number | boolean | undefined>;
const dataAPI = "https://www.googleapis.com/youtube/v3/";
const analyticsAPI = "https://youtubeanalytics.googleapis.com/v2/";

// Read-only access to one channel: YouTube Data API (channel check) and
// YouTube Analytics API (reports), using a stored offline refresh token.
export type GoogleCredentials = { clientId?: string; clientSecret?: string; refreshToken?: string };

export const CONSENT_TASK = "cuenv task consent (in projects/rawkode.academy/platform/youtube-control)";

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
      await response.body?.cancel();
      throw new ServiceError("google_api_error", `${operation} failed (HTTP ${response.status}); check access, quota and API configuration`, 502, response.status);
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
  analytics<T>(query: Query) { return this.get<T>(analyticsAPI, "reports", { ...query, ids: `channel==${this.channelId}` }); }
  async checkChannel() {
    const result = await this.get<{ items?: { id: string }[]; nextPageToken?: string }>(dataAPI, "channels", { part: "id", mine: true, maxResults: 50 });
    // The grant must identify exactly the configured YouTube/Brand channel.
    ensure(result.items?.length === 1 && result.items[0].id === this.channelId && !result.nextPageToken, "wrong_channel", "Authorize the configured YouTube/Brand channel directly; Google must identify exactly that channel", 403);
  }
  // Channel-wide totals. YouTube rounds subscriberCount to three significant figures.
  async channelStatistics(): Promise<{ subscriberCount: number | null; viewCount: number; videoCount: number }> {
    const result = await this.get<{ items?: { id: string; statistics?: { subscriberCount?: string; hiddenSubscriberCount?: boolean; viewCount?: string; videoCount?: string } }[] }>(dataAPI, "channels", { part: "statistics", id: this.channelId });
    const item = result.items?.[0];
    ensure(result.items?.length === 1 && item?.id === this.channelId && item.statistics, "invalid_google_response", "channels returned no statistics for the configured channel", 502);
    const stats = item!.statistics!;
    const count = (value: string | undefined) => { const n = Number(value); return Number.isSafeInteger(n) && n >= 0 ? n : null; };
    const views = count(stats.viewCount);
    const videos = count(stats.videoCount);
    ensure(views !== null && videos !== null, "invalid_google_response", "channels returned malformed statistics", 502);
    return { subscriberCount: stats.hiddenSubscriberCount ? null : count(stats.subscriberCount), viewCount: views!, videoCount: videos! };
  }
}
