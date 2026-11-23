import { timingSafeEqual } from "node:crypto";
import { ensure, hash } from "./domain.ts";

export async function authenticate(request: Request, env: Pick<CloudflareEnv, "READ_API_TOKEN" | "WRITE_API_TOKEN">) {
  const readToken = env.READ_API_TOKEN;
  const writeToken = env.WRITE_API_TOKEN;
  ensure(readToken?.length >= 32 && writeToken?.length >= 32 && readToken !== writeToken, "not_configured", "API credentials are not configured", 503);
  const header = request.headers.get("authorization") ?? "";
  ensure(/^Bearer [^\s]{32,1024}$/.test(header), "unauthorized", "A bearer token is required", 401);
  const presented = Buffer.from(await hash(header.slice(7)));
  const write = timingSafeEqual(presented, Buffer.from(await hash(writeToken)));
  const read = timingSafeEqual(presented, Buffer.from(await hash(readToken)));
  ensure(write || read, "unauthorized", "Invalid API credentials", 401);
  return { canWrite: write };
}
export function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  ensure(!origin || origin === new URL(request.url).origin, "invalid_origin", "Cross-origin browser requests are not supported", 403);
}
