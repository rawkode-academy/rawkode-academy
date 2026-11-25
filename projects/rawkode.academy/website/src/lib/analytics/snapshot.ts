// The numbers on /analytics move slowly, so they are computed once a day (cron
// in worker.ts) and kept in KV. The page reads one key instead of running
// Basin SQL over the whole lake on every view. An empty KV (first deploy, or
// the key expired) is filled on demand.
import {
	type LakeVideo,
	lakeCatalogueSql,
	videoIdPattern,
} from "../../../../../../packages/guest-scope/index";
import { guestVideosSql } from "@/lib/analytics/guest";
import { type ReachQuery, reachQueries, reachWindow } from "@/lib/analytics/reach";
import type { ContentKV } from "@/lib/live-content/env";
import { type BasinConfig, basinQuery, type Row } from "@/server/basin";

export const SNAPSHOT_KEY = "analytics:snapshot:v1";
/** Longer than a day, so one missed refresh still serves the last numbers. */
const SNAPSHOT_TTL_SECONDS = 7 * 86_400;

export type VideoStats = {
	views: { d90: number; lifetime: number };
	minutes: { d90: number; lifetime: number };
};

export type Snapshot = {
	generatedAt: string;
	reach: Record<ReachQuery, Row[]>;
	/** Every YouTube video in the lake, for matching Academy videos by title. */
	lake: LakeVideo[];
	/** Per YouTube video ID. */
	videos: Record<string, VideoStats>;
};

const num = (value: unknown) => Number(value ?? 0);

// Basin queries run uncached here (ttl 0 is not an option on the client), so a
// refresh always reads the lake; the page never does.
export async function buildSnapshot(
	config: BasinConfig,
	now = new Date(),
): Promise<Snapshot> {
	const window = reachWindow(now);
	const queries = reachQueries(window);
	const names = Object.keys(queries) as ReachQuery[];
	const [reachRows, catalogue] = await Promise.all([
		Promise.all(
			names.map((name) => basinQuery(config, queries[name], { ttlSeconds: 60 })),
		),
		basinQuery(config, lakeCatalogueSql, { ttlSeconds: 60 }),
	]);
	const lake = catalogue.flatMap((row) =>
		typeof row.video === "string" && typeof row.title === "string"
			? [{ video: row.video, title: row.title }]
			: [],
	);
	const ids = [
		...new Set(lake.map((video) => video.video).filter((id) => videoIdPattern.test(id))),
	];
	const videos: Record<string, VideoStats> = {};
	if (ids.length > 0) {
		const rows = await basinQuery(config, guestVideosSql(ids, window), {
			ttlSeconds: 60,
		});
		for (const row of rows) {
			videos[String(row.video)] = {
				views: { d90: num(row.views_d90), lifetime: num(row.views_lifetime) },
				minutes: { d90: num(row.minutes_d90), lifetime: num(row.minutes_lifetime) },
			};
		}
	}
	return {
		generatedAt: now.toISOString(),
		reach: Object.fromEntries(
			names.map((name, i) => [name, reachRows[i] ?? []]),
		) as Snapshot["reach"],
		lake,
		videos,
	};
}

/** Computes the snapshot and stores it. Throws when any source fails, leaving the previous snapshot in place. */
export async function refreshSnapshot(
	config: BasinConfig,
	kv: ContentKV,
	now = new Date(),
): Promise<Snapshot> {
	const snapshot = await buildSnapshot(config, now);
	await kv.put(SNAPSHOT_KEY, JSON.stringify(snapshot), {
		expirationTtl: SNAPSHOT_TTL_SECONDS,
	});
	return snapshot;
}

/** The stored snapshot, filled on demand when there is none. */
export async function loadSnapshot(
	config: BasinConfig,
	kv: ContentKV | undefined,
): Promise<Snapshot> {
	const stored = await kv?.get<Snapshot>(SNAPSHOT_KEY, { type: "json" });
	if (stored) return stored;
	return kv ? refreshSnapshot(config, kv) : buildSnapshot(config);
}
