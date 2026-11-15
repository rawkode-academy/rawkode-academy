import type { APIRoute } from "astro";
import { ACHIEVEMENTS } from "@/lib/games/guess-the-logo-achievements";

export const prerender = false;
export const GET: APIRoute = async () => new Response(JSON.stringify(ACHIEVEMENTS), {
  headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
});
