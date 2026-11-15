import type { APIRoute } from "astro";
import { getCollection } from "@/lib/live-content";
import { resolveTechnologyIconUrl } from "@/utils/resolve-technology-icon";
import { weekKey, buildWeeklyRounds, type CncfStatus } from "@/lib/games/guess-the-logo";

/** Canonical weekly rounds, shared with authenticated game clients. */
export const GET: APIRoute = async ({ locals, url }) => {
  const headers = { "Content-Type": "application/json", "Cache-Control": "private, no-store" };
  if (!locals.user) {
    return new Response(JSON.stringify({ error: "Authentication required" }), { status: 401, headers });
  }
  // Older preview APKs requested practice rounds. Never return the weekly
  // answers in response to that obsolete request.
  if (url.searchParams.get("mode") === "practice") {
    return new Response(JSON.stringify({ error: "Practice is no longer available" }), { status: 410, headers });
  }
  try {
    const entries = await getCollection("technologies");
    const logos = entries.map((entry) => {
      const iconUrl = resolveTechnologyIconUrl(entry.id, entry.data.logos);
      if (!iconUrl) return null;
      return {
        name: entry.data.name,
        iconUrl,
        cncfStatus: (entry.data.cncf?.status ?? null) as CncfStatus,
      };
    }).filter((logo): logo is NonNullable<typeof logo> => logo !== null);
    const now = new Date();
    return new Response(JSON.stringify({ week: weekKey(now), poolSize: logos.length, rounds: buildWeeklyRounds(logos, now) }), { headers });
  } catch {
    return new Response(JSON.stringify({ error: "Rounds unavailable" }), { status: 503, headers });
  }
};
