import { z } from "zod";

export class ServiceError extends Error {
  constructor(public code: string, message: string, public status = 400, public upstreamStatus?: number) { super(message); }
}
export function ensure(value: unknown, code: string, message: string, status = 400): asserts value {
  if (!value) throw new ServiceError(code, message, status);
}
export function errorBody(error: unknown) {
  if (error instanceof z.ZodError) return { error: "invalid_input", message: "Invalid request", issues: error.issues.map(i => ({ path: i.path, message: i.message })), status: 400 };
  if (error instanceof ServiceError) return { error: error.code, message: error.message, status: error.status, ...(error.upstreamStatus === undefined ? {} : { upstreamStatus: error.upstreamStatus }) };
  // Upstream bodies, OAuth secrets and unexpected exception messages never escape.
  return { error: "internal_error", message: "Operation failed", status: 500 };
}

export function validDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
export function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  ensure(!origin || origin === new URL(request.url).origin, "invalid_origin", "Cross-origin browser requests are not supported", 403);
}
export const daySchema = z.string().refine(validDay, "Expected a real YYYY-MM-DD date");

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
