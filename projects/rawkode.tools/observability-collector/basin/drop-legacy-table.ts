// One-time, explicitly requested cleanup. Never log the catalog credential.
import { readFile } from "node:fs/promises";

const ACCOUNT = "0aeb879de8e3cdde5fb3d413025222ce";
const BUCKET = "rawkode-analytics";
const LEGACY = "events";
const LIVE = ["events_archive", "short_links"];
// The additive browser table may not exist until its first flush.
const OPTIONAL = ["browser_events_v1"];
// A CI purge is always explicit; pushes, schedules, PRs and feature refs cannot delete.
if (
	process.env.GITHUB_ACTIONS === "true" &&
	(process.env.GITHUB_REPOSITORY !== "rawkode-academy/rawkode-academy" ||
		process.env.GITHUB_REF !== "refs/heads/main" ||
		process.env.GITHUB_EVENT_NAME !== "workflow_dispatch")
)
	throw new Error(
		"Legacy purge in CI requires manual dispatch on repository main",
	);

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
	declarations.length < LIVE.length ||
	declarations.length > LIVE.length + OPTIONAL.length ||
	new Set(declarations.map(([, value]) => value?.trim())).size !==
		declarations.length ||
	LIVE.some(
		(name) =>
			!declarations.some(([, value]) => value?.trim() === JSON.stringify(name)),
	) ||
	declarations.some(
		([, value]) =>
			![...LIVE, ...OPTIONAL].some(
				(name) => value?.trim() === JSON.stringify(name),
			),
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
		"current-snapshot-id"?: number | string;
		snapshots?: {
			"snapshot-id": number | string;
			summary?: Record<string, string>;
		}[];
	};
};
type Maintenance = {
	maintenance_config?: {
		compaction?: { state: string };
		snapshot_expiration?: { state: string };
	};
};

async function request<T>(url: string, method = "GET"): Promise<T> {
	let response: Response;
	try {
		response = await fetch(url, {
			method,
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(30_000),
		});
	} catch {
		throw new Error(
			`Catalog ${method} transport failed; recheck catalog state`,
		);
	}
	// Do not include response bodies or request headers in errors.
	if (!response.ok)
		throw new Error(`Catalog ${method} failed (${response.status})`);
	if (response.status === 204) return undefined as T;
	let body: { success?: boolean; result?: T };
	try {
		body = await response.json();
	} catch {
		throw new Error(`Catalog ${method} returned invalid JSON`);
	}
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
async function verifyMaintenance(live: string[]) {
	for (const name of live) {
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
const survivors = before.filter((name) => name !== LEGACY);
const optional = OPTIONAL.filter(
	(name) =>
		survivors.includes(name) &&
		declarations.some(([, value]) => value?.trim() === JSON.stringify(name)),
);
// Still refuse unknown/undeclared tables and require both original live tables.
same(survivors, [...LIVE, ...optional]);
if (!before.includes(LEGACY)) {
	same(before, survivors);
	await verifyMaintenance(survivors);
	console.log("analytics.events is already absent; nothing dropped");
} else {
	same(before, [...survivors, LEGACY]);
	await verifyMaintenance(survivors);
	const loaded = await request<Loaded>(`${tables}/${LEGACY}`);
	const metadata = loaded.metadata;
	const snapshotId = metadata["current-snapshot-id"];
	const snapshots = metadata.snapshots ?? [];
	const snapshot = snapshots.find(
		(s: { "snapshot-id": number | string }) =>
			String(s["snapshot-id"]) === String(snapshotId),
	);
	const noSnapshot = snapshotId == null || String(snapshotId) === "-1";
	// Never purge/report an imprecisely parsed or nonnumeric snapshot identifier.
	if (
		!noSnapshot &&
		!(
			(typeof snapshotId === "number" &&
				Number.isSafeInteger(snapshotId) &&
				snapshotId >= 0) ||
			(typeof snapshotId === "string" &&
				/^(0|[1-9][0-9]{0,18})$/.test(snapshotId) &&
				BigInt(snapshotId) <= 9223372036854775807n)
		)
	)
		throw new Error(
			"Legacy snapshot identifier is not proven exact; refusing to drop",
		);
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
	same(await names(), survivors);
	await verifyMaintenance(survivors);
	console.log("Dropped analytics.events with purge");
}
