// Read-only: prints what a guest's GitHub username would see in the Rawkode
// Tools MCP, from the same code the Worker runs, against the live Academy API
// and the live analytics lake. Usage: node scripts/preview-guest.ts <username>
import { basinConfig, basinQuery } from "../src/basin.ts";
import { fetchAcademyVideos, fetchLakeCatalogue, guestDailySql, visibleEpisodes, youtubeIds } from "../src/guest.ts";

const username = process.argv[2];
if (!username) throw new Error("Usage: preview-guest.ts <github username>");
const basin = basinConfig({ BASIN_ACCOUNT_ID: "0aeb879de8e3cdde5fb3d413025222ce", BASIN_BUCKET: "rawkode-analytics", BASIN_SQL_TOKEN: process.env.BASIN_SQL_TOKEN ?? "" });
const [videos, lake] = await Promise.all([fetchAcademyVideos(), fetchLakeCatalogue(basin)]);
const ids = youtubeIds(videos, lake);
console.log(`Academy videos: ${videos.length}. YouTube catalogue: ${lake.length}. Academy videos tied to one YouTube video: ${ids.size}.`);
const withGuests = videos.filter(v => v.guests.length > 0);
const guestIds = new Set(withGuests.flatMap(v => v.guests.map(g => g.id)));
console.log(`Guests: ${videos.length} videos, ${withGuests.length} with at least one guest, ${guestIds.size} distinct guests. Of the videos with guests, ${withGuests.filter(v => ids.has(v.id)).length} tie to YouTube.`);
const episodes = visibleEpisodes(videos, username).map(episode => ({ ...episode, youtube: ids.get(episode.id) ?? null }));
console.log(`\n${username} would see ${episodes.length} episodes (${episodes.filter(e => e.youtube).length} with YouTube numbers):`);
const totals = new Map<string, { days: number; views: number }>();
const tracked = episodes.filter(e => e.youtube).map(e => e.youtube!);
if (tracked.length > 0) {
  const { rows } = await basinQuery(basin, guestDailySql(tracked, "2005-01-01", "2099-12-31"), 100000);
  for (const row of rows) {
    const total = totals.get(String(row.video)) ?? { days: 0, views: 0 };
    totals.set(String(row.video), { days: total.days + 1, views: total.views + Number(row.views ?? 0) });
  }
}
for (const e of episodes.sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))) {
  const total = e.youtube ? totals.get(e.youtube) : undefined;
  console.log(`- [${e.role}] ${e.publishedAt?.slice(0, 10) ?? "undated"} ${e.title} (show: ${e.show ?? "none"}) youtube=${e.youtube ?? "NONE"}${total ? ` days=${total.days} views=${total.views}` : e.youtube ? " no per-video rows yet" : ""}`);
}
const unmatched = videos.filter(v => !ids.has(v.id));
console.log(`\nAcademy videos with no YouTube match (${unmatched.length}), first 15:`);
for (const v of unmatched.slice(0, 15)) console.log(`- ${v.slug}: ${v.title}`);
