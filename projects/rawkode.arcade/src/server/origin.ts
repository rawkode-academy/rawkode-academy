import type { Env } from "../env";

/** Reject cross-origin browser mutations, including requests without cookies. */
export function mutationOriginAllowed(request: Request, env: Pick<Env, "ENVIRONMENT">): boolean {
	if (env.ENVIRONMENT === "test" || ["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
	return request.headers.get("origin") === new URL(request.url).origin;
}
