import type { APIRoute } from "astro";

const BODY = `User-agent: *
Allow: /image
Disallow: /
`;

export const GET: APIRoute = () =>
  new Response(BODY, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      "X-Robots-Tag": "noindex",
    },
  });

export const prerender = true;
