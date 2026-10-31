import { ensure, readLimited, ServiceError, type Broadcast, type Session, type SessionState } from "./domain.ts";

type Query = Record<string, string | number | boolean | undefined>;
export type WritePrecondition = { ifMatch?: string };
const dataAPI = "https://www.googleapis.com/youtube/v3/";
const analyticsAPI = "https://youtubeanalytics.googleapis.com/v2/";
export interface PublishingAPI {
  checkChannel(): Promise<void>;
  broadcast(id: string): Promise<Broadcast>;
  broadcasts(): Promise<Broadcast[]>;
  checkStream(id: string): Promise<void>;
  request<T>(method: string, resource: string, query?: Query, body?: unknown, precondition?: WritePrecondition): Promise<T>;
  upload(id: string, bytes: Uint8Array, contentType: string): Promise<void>;
}

export class GoogleClient implements PublishingAPI {
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
      let definitiveRejection = false;
      if ([400, 401, 403, 404].includes(response.status) && response.headers.get("content-type")?.split(";")[0] === "application/json") {
        try {
          const body = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 65536)));
          definitiveRejection = body?.error?.code === response.status && typeof body.error.message === "string" && Array.isArray(body.error.errors) && body.error.errors.length > 0 && body.error.errors.every((entry: unknown) => typeof entry === "object" && entry !== null && "reason" in entry && typeof entry.reason === "string");
        } catch { /* An unreadable or oversized rejection remains uncertain. */ }
      } else await response.body?.cancel();
      if (response.status === 412) throw new ServiceError("stale_plan", "YouTube changed before the write completed; prepare a new plan", 409, response.status);
      throw new ServiceError("google_api_error", `${operation} failed (HTTP ${response.status}); check access, quota and API configuration`, 502, response.status, definitiveRejection);
    }
    try { return JSON.parse(new TextDecoder().decode(await readLimited(response.body, max))) as T; }
    catch (error) { if (error instanceof ServiceError) throw error; throw new ServiceError("invalid_google_response", `${operation} returned invalid JSON`, 502); }
  }
  private async call<T>(base: string, method: string, resource: string, query: Query = {}, body?: unknown, contentType?: string, precondition?: WritePrecondition): Promise<T> {
    const url = new URL(resource, base);
    ensure(url.origin === new URL(base).origin && url.pathname.startsWith(new URL(base).pathname), "invalid_resource", "Google API resource must stay within its configured API");
    await this.authorize();
    for (const [key, value] of Object.entries(query)) if (value !== undefined) url.searchParams.set(key, String(value));
    // Writes are deliberately never retried automatically.
    const response = await this.fetcher(url, {
      method, signal: AbortSignal.timeout(20000), redirect: "manual",
      headers: { authorization: `Bearer ${this.token}`, ...(precondition?.ifMatch ? { "if-match": precondition.ifMatch } : {}), ...(body === undefined ? {} : { "content-type": contentType ?? "application/json" }) },
      body: body === undefined ? undefined : contentType ? new Uint8Array(body as Uint8Array) : JSON.stringify(body),
    });
    return this.decode<T>(response, `${method} ${resource}`);
  }
  request<T>(method: string, resource: string, query: Query = {}, body?: unknown, precondition?: WritePrecondition) { return this.call<T>(dataAPI, method, resource, query, body, undefined, precondition); }
  analytics<T>(query: Query) { return this.call<T>(analyticsAPI, "GET", "reports", { ...query, ids: `channel==${this.channelId}` }); }
  async checkChannel() {
    const result = await this.request<{ items?: { id: string }[]; nextPageToken?: string }>("GET", "channels", { part: "id", mine: true, maxResults: 50 });
    // Ordinary liveBroadcasts.insert has no target-channel parameter. Membership
    // in an ambiguous channel list is not sufficient authorization to create:
    // the OAuth grant must identify exactly the selected YouTube/Brand channel.
    ensure(result.items?.length === 1 && result.items[0].id === this.channelId && !result.nextPageToken, "wrong_channel", "Authorize the configured YouTube/Brand channel directly; Google must identify exactly that channel", 403);
  }
  async broadcast(id: string) {
    const result = await this.request<{ items?: Broadcast[] }>("GET", "liveBroadcasts", { part: "id,snippet,status,contentDetails", id });
    const item = result.items?.find(b => b.id === id);
    ensure(item, "broadcast_not_found", "Broadcast was not found; refusing to create a replacement", 404);
    ensure(item.snippet.channelId === this.channelId, "wrong_channel", "Broadcast belongs to a different channel", 403);
    return item;
  }
  async broadcasts() {
    const items: Broadcast[] = [];
    let pageToken: string | undefined;
    // Bound discovery; truncation must fail closed instead of missing duplicates.
    for (let page = 0; page < 20; page++) {
      const result: { items?: Broadcast[]; nextPageToken?: string } = await this.request("GET", "liveBroadcasts", { part: "id,snippet,status,contentDetails", broadcastStatus: "upcoming", broadcastType: "all", maxResults: 50, pageToken });
      items.push(...(result.items ?? []).filter(b => b.snippet.channelId === this.channelId));
      pageToken = result.nextPageToken;
      if (!pageToken) return items;
    }
    throw new ServiceError("discovery_limit", "Too many upcoming broadcasts; specify a broadcastId", 409);
  }
  async checkStream(id: string) {
    const result = await this.request<{ items?: { id: string; snippet: { channelId: string }; status: { streamStatus: string } }[] }>("GET", "liveStreams", { part: "id,snippet,status", id, fields: "items(id,snippet/channelId,status/streamStatus)" });
    const stream = result.items?.find(s => s.id === id && s.snippet.channelId === this.channelId);
    ensure(stream && stream.status.streamStatus !== "active", "invalid_stream", "Stream must belong to this channel and must not be active", 409);
  }
  async upload(id: string, bytes: Uint8Array, contentType: string) {
    const result = await this.call<{ items?: unknown[] }>("https://www.googleapis.com/upload/youtube/v3/", "POST", "thumbnails/set", { videoId: id, uploadType: "media" }, bytes, contentType);
    ensure(result.items?.length, "thumbnail_unconfirmed", "Google did not acknowledge the thumbnail upload", 502);
  }
}

export async function findBroadcast(api: PublishingAPI, session: Session, state: SessionState) {
  ensure(!session.broadcastId || !state.broadcastId || session.broadcastId === state.broadcastId, "id_conflict", "Session and stored state have different broadcast IDs", 409);
  const id = session.broadcastId ?? state.broadcastId;
  if (id) return api.broadcast(id);
  const intended = state.pendingCreate ?? session;
  ensure(intended.title && intended.scheduledStartTime, "missing_identity", "Discovery requires a title and scheduledStartTime");
  const scheduledStartTime = intended.scheduledStartTime;
  const matches = (await api.broadcasts()).filter(b => b.snippet.title === intended.title && Date.parse(b.snippet.scheduledStartTime) === Date.parse(scheduledStartTime));
  ensure(matches.length <= 1, "ambiguous_broadcast", "Multiple matching broadcasts exist; supply the intended broadcastId", 409);
  if (matches.length) return matches[0];
  ensure(!state.pendingCreate, "creation_unknown", "A previous creation outcome is unknown. Inspect YouTube and provide its broadcastId; creation will not be retried", 409);
  return null;
}
