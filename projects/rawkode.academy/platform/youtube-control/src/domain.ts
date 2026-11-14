import { z } from "zod";

export class ServiceError extends Error {
  constructor(public code: string, message: string, public status = 400, public upstreamStatus?: number, public definitiveRejection = false) { super(message); }
}
export function ensure(value: unknown, code: string, message: string, status = 400): asserts value {
  if (!value) throw new ServiceError(code, message, status);
}
export function errorBody(error: unknown) {
  if (error instanceof z.ZodError) return { error: "invalid_input", message: "Invalid request", issues: error.issues.map(i => ({ path: i.path, message: i.message })), status: 400 };
  if (error instanceof ServiceError) return { error: error.code, message: error.message, status: error.status, ...(error.upstreamStatus === undefined ? {} : { upstreamStatus: error.upstreamStatus }) };
  // Upstream bodies, OAuth secrets and unexpected exception messages never escape.
  return { error: "internal_error", message: "Operation failed; inspect the operation state before retrying a write", status: 500 };
}

export const videoId = z.string().regex(/^[A-Za-z0-9_-]{11}$/);
export const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export const daySchema = z.string().refine(validDay, "Expected a real YYYY-MM-DD date");
const timeSchema = z.string().refine(v => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) || !validDay(v.slice(0, 10))) return false;
  return Number.isFinite(Date.parse(v)) && +v.slice(11, 13) < 24 && +v.slice(14, 16) < 60 && +v.slice(17, 19) < 60;
}, "Expected a real ISO timestamp with an explicit timezone").transform(v => new Date(v).toISOString());

export const sessionSchema = z.object({
  sessionId: z.string().regex(/^[A-Za-z0-9_-]{1,100}$/),
  broadcastId: videoId.optional(),
  title: z.string().refine(v => v.trim().length > 0 && [...v].length <= 100 && !/[<>]/.test(v), "Title requires 1–100 characters without angle brackets").optional(),
  description: z.string().refine(v => new TextEncoder().encode(v).length <= 5000 && !/[<>]/.test(v), "Description must be at most 5,000 UTF-8 bytes without angle brackets").optional(),
  scheduledStartTime: timeSchema.optional(),
  scheduledEndTime: timeSchema.optional(),
  privacyStatus: z.enum(["private", "unlisted", "public"]).optional(),
  madeForKids: z.boolean().optional(),
  thumbnailSha256: sha256Schema.optional(),
  streamId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/).optional(),
}).strict().refine(s => !s.scheduledStartTime || !s.scheduledEndTime || s.scheduledEndTime > s.scheduledStartTime, "End must follow start");
export type Session = z.infer<typeof sessionSchema>;
export type Snippet = { title: string; description?: string; channelId?: string; scheduledStartTime: string; scheduledEndTime?: string; categoryId?: string };
export type Broadcast = { id: string; etag?: string; snippet: Snippet; status: { lifeCycleStatus: string; privacyStatus: "private" | "unlisted" | "public"; selfDeclaredMadeForKids?: boolean }; contentDetails?: { boundStreamId?: string } };
export type SessionState = {
  revision: number; broadcastId?: string; thumbnailSha256?: string;
  pendingCreate?: { title: string; scheduledStartTime: string; attemptedAt: string };
};
export type Action =
  | { kind: "create"; body: { snippet: Partial<Snippet>; status: { privacyStatus: string; selfDeclaredMadeForKids: boolean }; contentDetails: Record<string, boolean> } }
  | { kind: "update"; body: { id: string; snippet: Partial<Snippet> }; fields: string[] }
  | { kind: "thumbnail"; sha256: string }
  | { kind: "bind"; streamId: string };
export type Plan = { planId: string; session: Session; revision: number; fingerprint: string; broadcastId: string | null; actions: Action[]; createdAt: string; expiresAt: string; status: "prepared" | "applying" | "applied" | "failed"; result?: PublishResult };
export type PublishResult = { broadcastId: string; channelId: string; title: string; scheduledStartTime: string; privacyStatus: string; lifeCycleStatus: string; url: string; changed: Action["kind"][]; verifiedAt: string; thumbnail: string };

const snippetKeys = ["title", "description", "categoryId", "scheduledStartTime", "scheduledEndTime"] as const;
export function pickSnippet(value: Partial<Snippet>) {
  return Object.fromEntries(snippetKeys.filter(k => value[k] !== undefined).map(k => [k, value[k]])) as Partial<Snippet>;
}
const same = (key: string, a: unknown, b: unknown) => key.endsWith("Time") ? Date.parse(String(a)) === Date.parse(String(b)) : a === b;
export function actionsFor(session: Session, current: Broadcast | null, state: SessionState, now = Date.now()): Action[] {
  const actions: Action[] = [];
  if (!current) {
    ensure(session.title !== undefined && session.description !== undefined && session.scheduledStartTime !== undefined && session.privacyStatus !== undefined && session.madeForKids !== undefined, "incomplete_create", "Creation requires title, description, scheduledStartTime, privacyStatus and madeForKids");
    ensure(Date.parse(session.scheduledStartTime) > now, "past_start", "Start must be in the future");
    actions.push({ kind: "create", body: { snippet: pickSnippet(session), status: { privacyStatus: session.privacyStatus, selfDeclaredMadeForKids: session.madeForKids }, contentDetails: { enableAutoStart: false, enableAutoStop: false, enableDvr: true, recordFromStart: true } } });
  } else {
    ensure(["created", "ready"].includes(current.status.lifeCycleStatus), "not_upcoming", "Only upcoming broadcasts can be changed", 409);
    ensure(session.privacyStatus === undefined || session.privacyStatus === current.status.privacyStatus, "visibility_change", "Existing visibility changes require review in YouTube Studio", 409);
    ensure(session.madeForKids === undefined || session.madeForKids === current.status.selfDeclaredMadeForKids, "audience_change", "Existing audience changes require review in YouTube Studio", 409);
    const snippet = { ...pickSnippet(current.snippet), ...pickSnippet(session) };
    const fields = snippetKeys.filter(k => k in session && !same(k, snippet[k], current.snippet[k]));
    if (fields.length) {
      ensure(snippet.title && snippet.scheduledStartTime && Date.parse(snippet.scheduledStartTime) > now, "past_start", "Start must be in the future");
      ensure(!snippet.scheduledEndTime || Date.parse(snippet.scheduledEndTime) > Date.parse(snippet.scheduledStartTime), "invalid_end", "End must follow the updated start");
      actions.push({ kind: "update", body: { id: current.id, snippet }, fields });
    }
  }
  if (session.thumbnailSha256 && (state.broadcastId !== current?.id || state.thumbnailSha256 !== session.thumbnailSha256)) actions.push({ kind: "thumbnail", sha256: session.thumbnailSha256 });
  if (session.streamId && session.streamId !== current?.contentDetails?.boundStreamId) actions.push({ kind: "bind", streamId: session.streamId });
  return actions;
}
export async function hash(value: string | Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
export function fingerprint(current: Broadcast | null) {
  return hash(JSON.stringify(current ? { id: current.id, etag: current.etag, snippet: pickSnippet(current.snippet), status: { lifeCycleStatus: current.status.lifeCycleStatus, privacyStatus: current.status.privacyStatus, selfDeclaredMadeForKids: current.status.selfDeclaredMadeForKids }, boundStreamId: current.contentDetails?.boundStreamId } : null));
}
export function verify(session: Session & Partial<Snippet>, current: Broadcast, channelId: string) {
  ensure(current.snippet.channelId === channelId, "channel_mismatch", "Read-back channel mismatch", 502);
  for (const key of snippetKeys) if (key in session) ensure(same(key, (session as Partial<Snippet>)[key], current.snippet[key]), "verification_failed", `Read-back mismatch: ${key}`, 502);
  if (session.privacyStatus !== undefined) ensure(session.privacyStatus === current.status.privacyStatus, "verification_failed", "Read-back visibility mismatch", 502);
  if (session.madeForKids !== undefined) ensure(session.madeForKids === current.status.selfDeclaredMadeForKids, "verification_failed", "Read-back audience mismatch", 502);
  if (session.streamId) ensure(session.streamId === current.contentDetails?.boundStreamId, "verification_failed", "Read-back stream binding mismatch", 502);
}
export const MAX_THUMBNAIL_BYTES = 2 * 1024 * 1024;
export function thumbnailType(bytes: Uint8Array) {
  ensure(bytes.length > 8 && bytes.length <= MAX_THUMBNAIL_BYTES, "invalid_thumbnail", "PoC thumbnails must be at most 2 MiB");
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  throw new ServiceError("invalid_thumbnail", "Expected JPEG or PNG bytes");
}
export async function readLimited(body: ReadableStream<Uint8Array> | null, maxBytes: number) {
  if (!body) return new Uint8Array();
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      ensure(size <= maxBytes, "payload_too_large", "Payload exceeded the supported size", 413);
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
