import { mkdir, readFile, writeFile } from "node:fs/promises";

type Target = "preview" | "production";
type WranglerConfig = Record<string, unknown> & {
	name: string;
	main: string;
	vars: Record<string, string>;
	d1_databases: Array<Record<string, string>>;
	r2_buckets: Array<Record<string, string>>;
	assets?: Record<string, string>;
	routes?: unknown[];
};

const target = process.argv[2] as Target | undefined;
const dryRun = process.argv.includes("--dry-run");
const provision = process.argv.includes("--provision");
if (target !== "preview" && target !== "production") throw new Error("Usage: cloudflare-config.ts <preview|production> [--dry-run|--provision]");
if (provision && (!process.env.CF_ACCESS_TEAM_DOMAIN?.trim() || !process.env.CF_ACCESS_AUD?.trim())) {
	throw new Error("CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD are required for a deployable environment");
}

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID ?? "0aeb879de8e3cdde5fb3d413025222ce";
const databaseName = target === "preview" ? "rawkode-arcade-preview" : "rawkode-arcade";
const bucketName = target === "preview" ? "rawkode-arcade-assets-preview" : "rawkode-arcade-assets";
const databaseVariable = target === "preview" ? "CLOUDFLARE_PREVIEW_D1_DATABASE_ID" : "CLOUDFLARE_D1_DATABASE_ID";

async function wrangler(args: string[]): Promise<string> {
	const child = Bun.spawn(["bun", "x", "wrangler", ...args], { stdout: "pipe", stderr: "inherit", env: process.env });
	const output = await new Response(child.stdout).text();
	if ((await child.exited) !== 0) throw new Error(`wrangler ${args.join(" ")} failed`);
	return output;
}

function jsonFrom(output: string): unknown {
	const start = Math.min(...[output.indexOf("["), output.indexOf("{")].filter((index) => index >= 0));
	if (!Number.isFinite(start)) throw new Error("Wrangler returned no JSON");
	return JSON.parse(output.slice(start));
}

function findDatabase(value: unknown): { name?: string; uuid?: string } | undefined {
	if (Array.isArray(value)) return value.map(findDatabase).find(Boolean);
	if (!value || typeof value !== "object") return undefined;
	const record = value as Record<string, unknown>;
	if ((record.name === databaseName || record.database_name === databaseName) && typeof (record.uuid ?? record.database_id) === "string") {
		return { name: databaseName, uuid: String(record.uuid ?? record.database_id) };
	}
	return Object.values(record).map(findDatabase).find(Boolean);
}

async function provisionDatabase(): Promise<string> {
	const existing = findDatabase(jsonFrom(await wrangler(["d1", "list", "--json"])))?.uuid;
	if (existing) return existing;
	await wrangler(["d1", "create", databaseName]);
	const created = findDatabase(jsonFrom(await wrangler(["d1", "list", "--json"])))?.uuid;
	if (!created) throw new Error(`Cloudflare did not return an ID for ${databaseName}`);
	return created;
}

async function ensureBucket(): Promise<void> {
	const listed = await wrangler(["r2", "bucket", "list"]);
	if (!listed.split(/\s+/).includes(bucketName)) await wrangler(["r2", "bucket", "create", bucketName]);
}

let databaseId = process.env[databaseVariable];
if (provision) {
	if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is required to provision Cloudflare resources");
	databaseId = await provisionDatabase();
	await ensureBucket();
}
if (!databaseId && dryRun) databaseId = "00000000-0000-0000-0000-000000000000";
if (!databaseId) throw new Error(`${databaseVariable} is required (or pass --provision)`);

const generated = JSON.parse(await readFile("dist/server/wrangler.json", "utf8")) as WranglerConfig;
for (const key of ["configPath", "userConfigPath", "topLevelName", "definedEnvironments", "legacy_env"]) delete generated[key];
generated.name = target === "preview" ? "rawkode-arcade-preview" : "rawkode-arcade";
generated.main = "../dist/server/entry.mjs";
generated.account_id = accountId;
generated.vars = {
	ADMISSION_ENABLED: "true",
	ENVIRONMENT: target,
	CF_ACCESS_TEAM_DOMAIN: process.env.CF_ACCESS_TEAM_DOMAIN ?? "",
	CF_ACCESS_AUD: process.env.CF_ACCESS_AUD ?? "",
};
generated.d1_databases = [{ binding: "DB", database_name: databaseName, database_id: databaseId, migrations_dir: "../migrations" }];
generated.r2_buckets = [{ binding: "ARCADE_ASSETS", bucket_name: bucketName }];
generated.assets = { ...(generated.assets ?? {}), directory: "../dist/client" };
generated.routes = target === "production" ? [{ pattern: "play.rawkode.academy", custom_domain: true }] : [];

await mkdir(".wrangler", { recursive: true });
const outputPath = `.wrangler/deploy-${target}.json`;
await writeFile(outputPath, `${JSON.stringify(generated, null, 2)}\n`);
console.log(outputPath);
