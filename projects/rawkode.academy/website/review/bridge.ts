export type ReviewEnvironment = {
  REVIEW_ORIGIN?: string;
  REVIEW_BACKEND?: { fetch(request: Request): Promise<Response> };
};
const routes: Record<string, string[]> = {
  "/api/auth/login": ["GET"], "/api/auth/callback": ["GET"],
  "/api/auth/session": ["GET"], "/api/auth/logout": ["POST"],
  "/api/review": ["GET", "POST"],
  "/api/review/uploads": ["GET", "POST", "PUT"],
  "/api/review/upload-targets": ["GET"],
  "/api/review/reviewers": ["GET"],
  "/api/review/media": ["GET", "HEAD"],
  "/api/review/published-media": ["GET", "HEAD"],
};
export const privateHeaders = {
  "cache-control": "private, no-store", "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow", "x-content-type-options": "nosniff",
};
export function reviewReturnPath(value: string | null): string {
  return value && /^\/review(?:\?videoId=[1-9]\d*)?$/.test(value) && value.length < 100 ? value : "/review";
}
export async function reviewBridge(request: Request, env: ReviewEnvironment): Promise<Response> {
  const url = new URL(request.url);
  const fail = (status: number, error: string) => Response.json({ error }, { status, headers: privateHeaders });
  if (!["https://preview.rawkode.academy", "http://127.0.0.1:3100"].includes(env.REVIEW_ORIGIN ?? "") || url.origin !== env.REVIEW_ORIGIN) return fail(403, "Untrusted preview origin");
  const methods = routes[url.pathname];
  if (!methods) return fail(404, "Not found");
  if (!methods.includes(request.method)) return fail(405, "Method not allowed");
  if (["POST", "PUT"].includes(request.method) && request.headers.get("origin") !== env.REVIEW_ORIGIN) return fail(403, "Untrusted request origin");
  if (!env.REVIEW_BACKEND) return fail(503, "Review service is unavailable");
  const secure = url.protocol === "https:";
  const prefix = secure ? "__Host-" : "";
  const returnCookie = `${prefix}review-return`;
  const cookies = (request.headers.get("cookie") ?? "").split(";").map(value => value.trim());
  const allowedCookies = new Set([`${prefix}poc-oidc-session`, `${prefix}poc-oidc-transaction`]);
  const headers = new Headers();
  for (const name of ["origin", "content-type", "content-length", "x-upload-length", "accept", "range", "if-range"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("host", url.host);
  headers.set("cookie", cookies.filter(value => allowedCookies.has(value.split("=", 1)[0]!)).join("; "));
  try {
    // The binding selects the backend; URL and Origin remain the browser's origin.
    const response = await env.REVIEW_BACKEND.fetch(new Request(request, { headers, redirect: "manual" }));
    const outgoing = new Headers(response.headers);
    // Explicit append keeps callback's transaction-clear and session-set separate.
    outgoing.delete("set-cookie");
    for (const cookie of response.headers.getSetCookie()) outgoing.append("set-cookie", cookie);
    for (const [name, value] of Object.entries(privateHeaders)) outgoing.set(name, value);
    const cookieAttributes = `Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
    if (url.pathname === "/api/auth/login" && response.status === 302) {
      outgoing.append("set-cookie", `${returnCookie}=${encodeURIComponent(reviewReturnPath(url.searchParams.get("returnTo")))}; ${cookieAttributes}; Max-Age=600`);
    }
    if (url.pathname === "/api/auth/callback") {
      if (response.status === 303 && outgoing.get("location") === "/account") {
        const values = cookies.filter(value => value.startsWith(`${returnCookie}=`));
        let path: string | null = null;
        try { if (values.length === 1) path = decodeURIComponent(values[0]!.slice(returnCookie.length + 1)); } catch {}
        outgoing.set("location", reviewReturnPath(path));
      }
      outgoing.append("set-cookie", `${returnCookie}=; ${cookieAttributes}; Max-Age=0`);
    }
    return new Response(request.method === "HEAD" ? null : response.body, { status: response.status, headers: outgoing });
  } catch { return fail(502, "Review service is unavailable. Try again."); }
}
