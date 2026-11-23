import { timingSafeEqual } from "node:crypto";
import { ensure, hash } from "./domain.ts";

export async function authenticate(request: Request, env: Pick<CloudflareEnv, "API_TOKEN">) {
  ensure(env.API_TOKEN?.length >= 32, "not_configured", "API credentials are not configured", 503);
  const header = request.headers.get("authorization") ?? "";
  ensure(/^Bearer [^\s]{32,1024}$/.test(header), "unauthorized", "A bearer token is required", 401);
  const presented = Buffer.from(await hash(header.slice(7)));
  ensure(timingSafeEqual(presented, Buffer.from(await hash(env.API_TOKEN))), "unauthorized", "Invalid API credentials", 401);
}
export function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  ensure(!origin || origin === new URL(request.url).origin, "invalid_origin", "Cross-origin browser requests are not supported", 403);
}
