import { ServiceError } from "./domain.ts";

// The daily check that the lake agrees with YouTube. The lake's lifetime views
// for a video (the latest observation of each day, summed) are compared with
// the public count from the Data API. A video the lake undercounts is
// backfilled; one still undercounted the next day raises the alert.

// The lake lags YouTube by about three days and the public count includes
// views the Analytics API reports differently, so allow 5% plus a small floor.
export const TOLERANCE_RATIO = 0.05;
export const TOLERANCE_FLOOR = 25;

export type Drift = { videoId: string; lake: number; youtube: number };
export type Basin = { accountId: string; bucket: string; token: string };

export const LAKE_TOTALS_SQL = `
SELECT video, SUM(views) AS views FROM (
  SELECT json_get_str(value, 'data', 'video') AS video,
    json_get_int(value, 'data', 'views') AS views,
    ROW_NUMBER() OVER (PARTITION BY json_get_str(value, 'data', 'video'), json_get_str(value, 'data', 'day') ORDER BY json_get_str(value, 'data', 'fetchedAt') DESC) AS rn
  FROM analytics.events_archive
  WHERE event_source = 'rawkode-academy-youtube' AND event_type = 'youtube.video_daily'
) WHERE rn = 1 GROUP BY video`;

export async function lakeTotals(basin: Basin, fetcher: typeof fetch = (...args) => fetch(...args)): Promise<Map<string, number>> {
  const response = await fetcher(`https://api.sql.cloudflarestorage.com/api/v1/accounts/${basin.accountId}/basin-sql/query/${basin.bucket}`, {
    method: "POST", signal: AbortSignal.timeout(60000), redirect: "manual",
    headers: { authorization: `Bearer ${basin.token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: LAKE_TOTALS_SQL }),
  });
  if (!response.ok) { await response.body?.cancel(); throw new ServiceError("basin_error", `Basin SQL query failed (HTTP ${response.status})`, 502, response.status); }
  const body = await response.json() as { success?: boolean; result?: { rows?: unknown; schema?: ({ name: string } | string)[] }; rows?: unknown };
  const result = body.result ?? body as { rows?: unknown; schema?: ({ name: string } | string)[] };
  const rows = result.rows;
  if (body.success === false || !Array.isArray(rows)) throw new ServiceError("basin_error", "Basin SQL returned no rows array", 502);
  const columns = (result.schema ?? []).map(column => typeof column === "string" ? column : column.name);
  const totals = new Map<string, number>();
  for (const row of rows) {
    const record = Array.isArray(row) ? Object.fromEntries(row.map((value, i) => [columns[i] ?? `col${i}`, value])) : row as Record<string, unknown>;
    if (typeof record.video === "string") totals.set(record.video, Number(record.views) || 0);
  }
  return totals;
}

// Videos the lake undercounts beyond the tolerance. A video YouTube doesn't
// report is skipped; a video the lake has never seen counts as zero.
export function findDrift(videoIds: string[], lake: Map<string, number>, youtube: Map<string, number>): Drift[] {
  const drift: Drift[] = [];
  for (const videoId of videoIds) {
    const published = youtube.get(videoId);
    if (published === undefined) continue;
    const stored = lake.get(videoId) ?? 0;
    if (stored < published * (1 - TOLERANCE_RATIO) - TOLERANCE_FLOOR) drift.push({ videoId, lake: stored, youtube: published });
  }
  return drift.sort((a, b) => (b.youtube - b.lake) - (a.youtube - a.lake));
}
