import { ensure, readLimited, ServiceError } from "./domain.ts";

type Query = Record<string, string | number | boolean | undefined>;
const dataAPI = "https://www.googleapis.com/youtube/v3/";
const analyticsAPI = "https://youtubeanalytics.googleapis.com/v2/";

// Read-only access to one channel: YouTube Data API (channel check) and
// YouTube Analytics API (reports), using a stored offline refresh token.
export class GoogleClient {
  private token?: string;
  constructor(private credentialsJSON: string, public channelId: string, private fetcher: typeof fetch = (...args) => fetch(...args)) {}

  private async authorize() {
    if (this.token) return;
    let credentials;
    try { credentials = JSON.parse(this.credentialsJSON); } catch { throw new ServiceError("not_configured", "YouTube authorization is not configured", 503); }
    ensure([credentials?.client_id, credentials?.client_secret, credentials?.refresh_token].every(value => typeof value === "string" && value.length > 0), "not_configured", "YouTube authorization is incomplete", 503);
    ensure(!credentials.channel_id || credentials.channel_id === this.channelId, "wrong_channel", "Stored Google credentials belong to a different channel", 403);
    const response = await this.fetcher("https://oauth2.googleapis.com/token", {
      method: "POST", signal: AbortSignal.timeout(20000), redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", client_id: credentials.client_id, client_secret: credentials.client_secret, refresh_token: credentials.refresh_token }),
    });
    const value = await this.decode<{ access_token?: string }>(response, "oauth_refresh", 65536);
    ensure(typeof value.access_token === "string" && value.access_token.length > 0, "oauth_refresh", "Google authorization returned no access token; reauthorize the channel", 502);
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
}
