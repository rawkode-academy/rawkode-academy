// One-time, explicitly requested cleanup. Never log the catalog credential.
import { readFile } from "node:fs/promises";

const ACCOUNT = "0aeb879de8e3cdde5fb3d413025222ce";
const BUCKET = "rawkode-analytics";
const LEGACY = "events";
const LIVE = ["events_archive", "short_links"];
const token = process.env.BASIN_CATALOG_TOKEN;
if (!token) throw new Error("BASIN_CATALOG_TOKEN is not set");
if (process.env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT) {
	throw new Error("Unexpected Cloudflare account");
}

const infrastructure = await readFile(
	new URL("../infrastructure.cue", import.meta.url),
	"utf8",
);
// Strip comments before checking all table_name declarations; refuse expressions
// we cannot prove name another table.
const declarations = [
	...infrastructure
		.replace(/\/\/[^\n]*/g, "")
		.matchAll(/\btable_name\s*:\s*([^\n}]+)/g),
];
if (
	declarations.length !== LIVE.length ||
	declarations.some(
		([, value]) => !LIVE.some((name) => value.trim() === JSON.stringify(name)),
	)
) {
	throw new Error(
		"Sink table declarations changed; review infrastructure.cue before deleting",
	);
}

type Listing = {
	identifiers: { namespace: string[]; name: string }[];
	"next-page-token"?: string;
};
type Loaded = {
	metadata: {
		"current-snapshot-id"?: number;
		snapshots?: { "snapshot-id": number; summary?: Record<string, string> }[];
	};
};
type Maintenance = {
	maintenance_config?: {
		compaction?: { state: string };
		snapshot_expiration?: { state: string };
	};
};

async function request<T>(url: string, method = "GET"): Promise<T> {
	const response = await fetch(url, {
		method,
		headers: { Authorization: `Bearer ${token}` },
	});
	// Do not include response bodies or request headers in errors.
	if (!response.ok)
		throw new Error(`Catalog ${method} failed (${response.status})`);
	if (response.status === 204) return undefined as T;
	const body = (await response.json()) as { success?: boolean; result?: T };
	if (body.success === false)
		throw new Error(`Catalog ${method} was unsuccessful`);
	return (body.result ?? body) as T;
}

const catalog = `https://catalog.cloudflarestorage.com/${ACCOUNT}/${BUCKET}/v1`;
const tables = `${catalog}/namespaces/analytics/tables`;
const management = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/r2-catalog/${BUCKET}/namespaces/analytics/tables`;
async function names(): Promise<string[]> {
	const listing = await request<Listing>(tables);
	if (listing["next-page-token"])
		throw new Error("Unexpected catalog pagination");
	return listing.identifiers
		.map((id: { namespace: string[]; name: string }) => {
			if (id.namespace.join(".") !== "analytics")
				throw new Error("Unexpected namespace");
			return id.name;
		})
		.sort();
}
function same(actual: string[], expected: string[]) {
	if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
		throw new Error(`Unexpected tables: ${actual.join(", ")}`);
	}
}
async function verifyMaintenance() {
	for (const name of LIVE) {
		const body = await request<Maintenance>(
			`${management}/${name}/maintenance-configs`,
		);
		const config = body.maintenance_config;
		if (
			config?.compaction?.state !== "enabled" ||
			config?.snapshot_expiration?.state !== "enabled"
		) {
			throw new Error(`${name}: compaction or snapshot expiry is not enabled`);
		}
		console.log(`${name}: compaction and snapshot expiry enabled`);
	}
}

const before = await names();
if (!before.includes(LEGACY)) {
	same(before, LIVE);
	await verifyMaintenance();
	console.log("analytics.events is already absent; nothing dropped");
} else {
	same(before, [...LIVE, LEGACY]);
	await verifyMaintenance();
	const loaded = await request<Loaded>(`${tables}/${LEGACY}`);
	const metadata = loaded.metadata;
	const snapshotId = metadata["current-snapshot-id"];
	const snapshots = metadata.snapshots ?? [];
	const snapshot = snapshots.find(
		(s: { "snapshot-id": number }) =>
			String(s["snapshot-id"]) === String(snapshotId),
	);
	const noSnapshot = snapshotId == null || String(snapshotId) === "-1";
	// Be conservative: unexplained historical snapshots require manual review.
	if (
		noSnapshot
			? snapshots.length !== 0
			: !snapshot || String(snapshot.summary?.["total-records"]) !== "0"
	) {
		throw new Error("Legacy table is not proven empty; refusing to drop");
	}
	console.log(
		`analytics.events before drop: snapshot=${noSnapshot ? "none" : snapshotId}, records=0`,
	);
	await request(`${tables}/${LEGACY}?purgeRequested=true`, "DELETE");
	same(await names(), LIVE);
	await verifyMaintenance();
	console.log("Dropped analytics.events with purge");
}
