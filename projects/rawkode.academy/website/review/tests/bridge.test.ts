// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect, vi } from "vitest";
import { reviewBridge, reviewReturnPath } from "../bridge";
const origin = "https://preview.rawkode.academy";
function setup(response: Response = Response.json({ ok: true })) {
  const fetch = vi.fn(async (_request: Request) => response.clone());
  return { env: { REVIEW_ORIGIN: origin, REVIEW_BACKEND: { fetch } }, fetch };
}

describe("same-origin preview bridge", () => {
  it("forwards public URL and only OIDC cookies; strips supplied identity and proxy headers", async () => {
    const { env, fetch } = setup();
    await reviewBridge(new Request(`${origin}/api/review?videoId=10`, { headers: { cookie: "__Host-poc-oidc-session=opaque; rawkode-session=legacy; payload-token=admin; __Host-poc-oidc-transaction=tx", "x-user-id": "1", "x-forwarded-host": "admin.rawkode.academy", authorization: "Bearer forged" } }), env);
    const sent = fetch.mock.calls[0]![0];
    expect(sent.url).toBe(`${origin}/api/review?videoId=10`);
    expect(sent.redirect).toBe("manual");
    expect(sent.headers.get("cookie")).toBe("__Host-poc-oidc-session=opaque; __Host-poc-oidc-transaction=tx");
    for (const header of ["authorization", "x-user-id", "x-forwarded-host", "origin"]) expect(sent.headers.has(header)).toBe(false);
  });
  it("does not invent a trusted Origin for mutations", async () => {
    const { env, fetch } = setup();
    for (const path of ["/api/review", "/api/review/upload-targets", "/api/review/thumbnail?videoId=42"]) for (const requestOrigin of [undefined, "https://evil.example"]) {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (requestOrigin) headers.origin = requestOrigin;
      expect((await reviewBridge(new Request(`${origin}${path}`, { method: "POST", headers, body: "{}" }), env)).status).toBe(403);
    }
    expect(fetch).not.toHaveBeenCalled();
    await reviewBridge(new Request(`${origin}/api/review`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" }), env);
    expect(fetch.mock.calls[0]![0].headers.get("origin")).toBe(origin);
    expect(await fetch.mock.calls[0]![0].text()).toBe("{}");
  });
  it("streams bounded intake PUTs and checks origin before forwarding", async () => {
    const { env, fetch } = setup();
    for (const requestOrigin of [undefined, "https://evil.example", origin]) {
      const headers: Record<string, string> = { "content-type": "video/mp4", "content-length": "5" };
      if (requestOrigin) headers.origin = requestOrigin;
      const response = await reviewBridge(new Request(`${origin}/api/review/uploads?sessionId=fixture`, { method: "PUT", headers, body: "bytes" }), env);
      expect(response.status).toBe(requestOrigin === origin ? 200 : 403);
    }
    expect(fetch).toHaveBeenCalledTimes(1);
    const sent = fetch.mock.calls[0]![0];
    expect(sent.headers.get("content-length")).toBe("5");
    expect(sent.headers.get("content-type")).toBe("video/mp4");
    expect(await sent.text()).toBe("bytes");
  });
  it("forwards the browser-safe upload length header and staff lookup routes", async () => {
    const { env, fetch } = setup();
    const response = await reviewBridge(new Request(`${origin}/api/review/uploads?sessionId=fixture`, { method: "PUT", headers: { origin, "content-type": "video/mp4", "x-upload-length": "5" }, body: "bytes" }), env);
    expect(response.status).toBe(200);
    expect(fetch.mock.calls[0]![0].headers.get("x-upload-length")).toBe("5");
    await reviewBridge(new Request(`${origin}/api/review/upload-targets`), env);
    await reviewBridge(new Request(`${origin}/api/review/upload-targets`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ title: "Datum", description: "Review" }) }), env);
    await reviewBridge(new Request(`${origin}/api/review/reviewers`), env);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(fetch.mock.calls[2]![0].headers.get("origin")).toBe(origin);
    expect(await fetch.mock.calls[2]![0].json()).toEqual({ title: "Datum", description: "Review" });
  });
  it("forwards the feedback export download privately and refuses other methods", async () => {
    const { env, fetch } = setup(new Response("\uFEFFcomment_id\r\n", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="review-10-r-feedback.csv"', "cache-control": "public, max-age=60" } }));
    const response = await reviewBridge(new Request(`${origin}/api/review/feedback-export?videoId=10&revisionId=r`, { headers: { cookie: "__Host-poc-oidc-session=opaque; payload-token=admin" } }), env);
    expect(response.status).toBe(200);
    expect(fetch.mock.calls[0]![0].headers.get("cookie")).toBe("__Host-poc-oidc-session=opaque");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="review-10-r-feedback.csv"');
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const post = await reviewBridge(new Request(`${origin}/api/review/feedback-export?videoId=10&revisionId=r`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" }), env);
    expect(post.status).toBe(405);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("forwards private thumbnail bytes and revision-bound delivery", async () => {
    const { env, fetch } = setup();
    await reviewBridge(new Request(`${origin}/api/review/thumbnail?videoId=42`, { method: "POST", headers: { origin, "content-type": "image/png", "x-upload-length": "5" }, body: "image" }), env);
    expect(await fetch.mock.calls[0]![0].text()).toBe("image");
    expect(fetch.mock.calls[0]![0].headers.get("content-type")).toBe("image/png");
    const response = await reviewBridge(new Request(`${origin}/api/review/thumbnail?videoId=42&revisionId=cut`, { method: "HEAD" }), env);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.text()).toBe("");
  });
  it("rejects unconfigured origins, missing bindings and every non-allowlisted API", async () => {
    const { env, fetch } = setup();
    expect((await reviewBridge(new Request("https://evil.example/api/review"), env)).status).toBe(403);
    expect((await reviewBridge(new Request(`${origin}/api/review`), {})).status).toBe(403);
    expect((await reviewBridge(new Request(`${origin}/api/review`), { REVIEW_ORIGIN: origin })).status).toBe(503);
    for (const path of ["/api/users", "/admin", "/api/graphql", "/api/review/other", "/api/review/media/", "/api/auth/callback/extra", "/api/%72eview"]) expect((await reviewBridge(new Request(origin + path), env)).status).toBe(404);
    expect((await reviewBridge(new Request(`${origin}/api/review`, { method: "DELETE" }), env)).status).toBe(405);
    expect((await reviewBridge(new Request(`${origin}/api/auth/logout`), env)).status).toBe(405);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("keeps login redirects manual and binds only a validated review return path", async () => {
    const { env } = setup(new Response(null, { status: 302, headers: { location: "https://id.rawkode.academy/authorize", "set-cookie": "__Host-poc-oidc-transaction=tx; Path=/; HttpOnly; Secure" } }));
    const response = await reviewBridge(new Request(`${origin}/api/auth/login?returnTo=${encodeURIComponent('/review?videoId=42')}`), env);
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://id.rawkode.academy/authorize");
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(response.headers.getSetCookie()[1]).toContain("__Host-review-return=%2Freview%3FvideoId%3D42; Path=/; HttpOnly; SameSite=Lax; Secure");
    for (const path of ["//evil.example", "/admin", "/review?videoId=1&next=https://evil.example", "/review?videoId=1%0d%0a"]) expect(reviewReturnPath(path)).toBe("/review");
  });
  it("preserves both callback cookies and returns to the exact review deep link", async () => {
    const headers = new Headers({ location: "/account" });
    headers.append("set-cookie", "__Host-poc-oidc-transaction=; Path=/; HttpOnly; Secure; Max-Age=0");
    headers.append("set-cookie", "__Host-poc-oidc-session=new; Path=/; HttpOnly; Secure");
    const { env } = setup(new Response(null, { status: 303, headers }));
    const response = await reviewBridge(new Request(`${origin}/api/auth/callback?code=fixture&state=fixture`, { headers: { cookie: "__Host-review-return=%2Freview%3FvideoId%3D42" } }), env);
    expect(response.headers.getSetCookie()).toHaveLength(3);
    expect(response.headers.getSetCookie()[1]).toContain("__Host-poc-oidc-session=new");
    expect(response.headers.get("location")).toBe("/review?videoId=42");
    expect(response.headers.getSetCookie()[2]).toContain("Max-Age=0");
  });
  it.each([206, 416])("streams range status %s and private response headers", async status => {
    const { env, fetch } = setup(new Response(status === 206 ? "bytes" : null, { status, headers: { "content-range": status === 206 ? "bytes 5-9/10" : "bytes */10", "accept-ranges": "bytes", etag: '"fixture"', "content-type": "video/mp4", "cache-control": "public" } }));
    const response = await reviewBridge(new Request(`${origin}/api/review/media?videoId=10&revisionId=cut`, { headers: { range: "bytes=5-9", "if-range": '"fixture"' } }), env);
    expect(response.status).toBe(status);
    expect(response.headers.get("content-range")).toContain("/10");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetch.mock.calls[0]![0].headers.get("range")).toBe("bytes=5-9");
    expect(fetch.mock.calls[0]![0].headers.get("if-range")).toBe('"fixture"');
    if (status === 206) expect(await response.text()).toBe("bytes");
  });
  it("HEAD has no body, and fresh revoked requests keep the backend denial", async () => {
    const first = setup(new Response(null, { headers: { "content-length": "10", "accept-ranges": "bytes" } }));
    const head = await reviewBridge(new Request(`${origin}/api/review/media`, { method: "HEAD" }), first.env);
    expect(await head.text()).toBe(""); expect(head.headers.get("content-length")).toBe("10");
    const revoked = setup(Response.json({ error: "Review not found" }, { status: 404 }));
    expect((await reviewBridge(new Request(`${origin}/api/review/media`), revoked.env)).status).toBe(404);
    expect((await reviewBridge(new Request(`${origin}/api/review/media`), revoked.env)).status).toBe(404);
    expect(revoked.fetch).toHaveBeenCalledTimes(2);
  });
  it("never forwards a browser-supplied public origin header", async () => {
    const { env, fetch } = setup();
    await reviewBridge(new Request(`${origin}/api/review?videoId=10`, { headers: { "x-academy-public-origin": "https://admin.rawkode.academy" } }), env);
    await reviewBridge(new Request(`${origin}/api/review`, { method: "POST", headers: { origin, "content-type": "application/json", "x-academy-public-origin": "https://admin.rawkode.academy" }, body: "{}" }), env);
    expect(fetch).toHaveBeenCalledTimes(2);
    for (const [sent] of fetch.mock.calls) expect(sent.headers.has("x-academy-public-origin")).toBe(false);
  });
  const built = fileURLToPath(new URL("../../dist-review/server/wrangler.json", import.meta.url));
  it.skipIf(!existsSync(built))("built review Worker binds the Payload ReviewBridge entrypoint", () => {
    const services = JSON.parse(readFileSync(built, "utf8")).services as { binding: string; service: string; entrypoint?: string }[];
    expect(services.find(service => service.binding === "REVIEW_BACKEND")).toMatchObject({ service: "rawkode-academy-payload", entrypoint: "ReviewBridge" });
  });
});
