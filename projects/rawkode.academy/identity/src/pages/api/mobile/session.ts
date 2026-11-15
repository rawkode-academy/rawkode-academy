import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const prerender = false;

/** Resolve only unexpired access tokens issued to the public mobile client. */
export const GET: APIRoute = async ({ request }) => {
  const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };
  const match = /^Bearer ([A-Za-z0-9._~+\/-]{20,4096})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  try {
    const user = await env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.image, u.username, u.email_verified AS emailVerified
       FROM oauth_access_token t JOIN user u ON u.id = t.user_id
       JOIN oauth_application a ON a.client_id = t.client_id
       WHERE t.access_token = ? AND t.client_id = ? AND a.disabled = 0 AND t.access_token_expires_at > ? LIMIT 1`,
    ).bind(match[1], "rawkode-academy-mobile", Date.now()).first<{
      id: string; name: string; email: string; image: string | null; username: string | null; emailVerified: number;
    }>();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    return new Response(JSON.stringify({ user }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Authentication unavailable" }), { status: 503, headers });
  }
};

/** Revoke the current mobile access and refresh token pair. */
export const DELETE: APIRoute = async ({ request }) => {
  const headers = { "Cache-Control": "private, no-store", "Content-Type": "application/json" };
  const match = /^Bearer ([A-Za-z0-9._~+\/-]{20,4096})$/i.exec(request.headers.get("authorization") ?? "");
  if (!match) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
  try {
    await env.DB.prepare("DELETE FROM oauth_access_token WHERE access_token = ? AND client_id = ?")
      .bind(match[1], "rawkode-academy-mobile").run();
    return new Response(JSON.stringify({ revoked: true }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Authentication unavailable" }), { status: 503, headers });
  }
};
