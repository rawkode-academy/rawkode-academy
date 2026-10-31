#!/usr/bin/env node
// Run from this project after npm ci. Default mode prints a resource plan only.
import { readFile, writeFile, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import ts from "typescript";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ID = /^[a-f0-9]{32}$/;
export const requireThat = (ok, message) => { if (!ok) throw new Error(message); };
export function optionsFrom(argv) {
  const { values } = parseArgs({ args: argv, options: {
    apply: { type: "boolean", default: false }, help: { type: "boolean" },
    "account-id": { type: "string" }, origin: { type: "string" }, "owner-sub": { type: "string" },
    prefix: { type: "string", default: "rawkode-academy-youtube-control-poc" },
    "channel-id": { type: "string", default: "UCrber_mFvp_FEF7D9u8PDEA" },
  } });
  if (values.help) return { help: true };
  requireThat(ID.test(values["account-id"] ?? "") && !/^0+$/.test(values["account-id"]), "Supply --account-id with your Cloudflare account ID");
  requireThat(/^[a-z0-9][a-z0-9-]{1,40}-poc$/.test(values.prefix), "--prefix must be a lowercase name ending in -poc (up to 45 characters)");
  let origin;
  try { origin = new URL(values.origin); } catch { throw new Error("Supply --origin with the HTTPS workers.dev URL for this Worker"); }
  requireThat(origin.protocol === "https:" && origin.origin === values.origin && new RegExp(`^${values.prefix}\\.[a-z0-9-]+\\.workers\\.dev$`).test(origin.hostname) && !origin.username && !origin.password && !origin.port, "--origin must be https://<prefix>.<your-subdomain>.workers.dev, without a trailing slash");
  requireThat(/^[A-Za-z0-9_-]{1,255}$/.test(values["owner-sub"] ?? "") && values["owner-sub"] !== "NOT_CONFIGURED", "Supply --owner-sub with the exact Google subject printed by authorize.py");
  requireThat(/^UC[A-Za-z0-9_-]{22}$/.test(values["channel-id"]), "Invalid --channel-id");
  return { apply: values.apply, accountId: values["account-id"], origin: origin.origin, ownerSub: values["owner-sub"], prefix: values.prefix, channelId: values["channel-id"] };
}
export function resourceNames(prefix) {
  const sqlPrefix = prefix.replaceAll("-", "_");
  return { assets: `${prefix}-assets`, raw: `${prefix}-raw`, warehouse: `${prefix}-warehouse`, oauthKV: `${prefix}-oauth`, k2: `${sqlPrefix}_events`, subscription: "basin_ingestion", stream: `${sqlPrefix}_reports_stream`, sink: `${sqlPrefix}_reports_sink`, pipeline: `${sqlPrefix}_reports_pipeline` };
}
export async function loadBase() {
  const parsed = ts.parseConfigFileTextToJson("wrangler.jsonc", await readFile(resolve(project, "wrangler.jsonc"), "utf8"));
  requireThat(!parsed.error, "Invalid base Wrangler configuration");
  return parsed.config;
}
export function deploymentConfig(base, options, resources) {
  const names = resourceNames(options.prefix);
  return { ...base, name: options.prefix, account_id: options.accountId,
    vars: { ...base.vars, YOUTUBE_CHANNEL_ID: options.channelId, CLOUDFLARE_ACCOUNT_ID: options.accountId, PUBLIC_ORIGIN: options.origin, MCP_OWNER_GOOGLE_SUB: options.ownerSub, BASIN_BUCKET_NAME: names.warehouse, K2_STREAM_ID: resources.k2Id, K2_SUBSCRIPTION_ID: resources.subscriptionId },
    r2_buckets: [{ binding: "ASSETS", bucket_name: names.assets }, { binding: "ANALYTICS_RAW", bucket_name: names.raw }],
    kv_namespaces: [{ binding: "OAUTH_KV", id: resources.kvId }],
    k2: [{ binding: "ANALYTICS_EVENTS", stream: resources.k2Id }],
    pipelines: [{ binding: "ANALYTICS_PIPELINE", stream: resources.streamId }],
  };
}
export function validateDeployment(config) {
  requireThat(config.name?.endsWith("-poc"), "The deploy helper only accepts a PoC Worker name");
  const ids = [config.account_id, config.vars?.CLOUDFLARE_ACCOUNT_ID, config.vars?.K2_STREAM_ID, config.vars?.K2_SUBSCRIPTION_ID, config.kv_namespaces?.find(b => b.binding === "OAUTH_KV")?.id, config.k2?.find(b => b.binding === "ANALYTICS_EVENTS")?.stream, config.pipelines?.find(b => b.binding === "ANALYTICS_PIPELINE")?.stream];
  requireThat(ids.every(id => typeof id === "string" && ID.test(id) && !/^0+$/.test(id)), "Provision real resource IDs with npm run setup -- --apply before deploying");
  requireThat(config.vars.K2_STREAM_ID === config.k2.find(b => b.binding === "ANALYTICS_EVENTS").stream, "K2 producer and consumer IDs differ");
  requireThat(config.account_id === config.vars.CLOUDFLARE_ACCOUNT_ID, "Cloudflare account IDs differ");
  optionsFrom(["--account-id", config.account_id, "--origin", config.vars.PUBLIC_ORIGIN, "--owner-sub", config.vars.MCP_OWNER_GOOGLE_SUB, "--prefix", config.name, "--channel-id", config.vars.YOUTUBE_CHANNEL_ID]);
  requireThat(config.r2_buckets?.every(b => b.bucket_name && !b.bucket_name.includes("not-provisioned")) && !config.vars.BASIN_BUCKET_NAME.includes("not-provisioned"), "R2/Basin buckets are not provisioned");
}
export class CloudflareSetup {
  constructor(accountId, managementToken, consumeToken, fetcher = fetch) { this.accountId = accountId; this.token = managementToken; this.consumeToken = consumeToken; this.fetcher = fetcher; }
  async request(method, path, body, { optional = false, k2Id } = {}) {
    const url = k2Id ? `https://${k2Id}.k2.cloudflarestorage.com${path}` : `https://api.cloudflare.com/client/v4/accounts/${this.accountId}${path}`;
    const response = await this.fetcher(url, { method, redirect: "error", signal: AbortSignal.timeout(30000), headers: { authorization: `Bearer ${k2Id ? this.consumeToken : this.token}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (optional && response.status === 404) { await response.body?.cancel(); return null; }
    let data;
    try { data = await response.json(); } catch { throw new Error(`Cloudflare ${method} ${path.split("?")[0]} returned invalid JSON (HTTP ${response.status})`); }
    // Upstream text can echo sensitive fields. Surface codes only.
    requireThat(response.ok && data.success === true, `Cloudflare ${method} ${path.split("?")[0]} failed (HTTP ${response.status}; codes ${(data.errors ?? []).map(e => e.code).filter(Number.isFinite).join(",") || "unknown"})`);
    return data;
  }
  async named(path, name, field = "name") {
    const matches = [];
    const seen = new Set();
    for (let page = 1; page <= 100; page++) {
      const query = new URLSearchParams({ page: String(page), per_page: "100", ...(field === "name" ? { name } : {}) });
      const data = await this.request("GET", `${path}?${query}`);
      requireThat(Array.isArray(data.result), "Unexpected Cloudflare list response");
      let added = 0;
      for (const resource of data.result) {
        requireThat(typeof resource.id === "string", "Cloudflare listed a resource without an ID");
        if (seen.has(resource.id)) continue;
        seen.add(resource.id);
        added++;
        if (resource[field] === name) matches.push(resource);
      }
      requireThat(data.result.length === 0 || added > 0, "Cloudflare resource pagination did not advance; refusing incomplete discovery");
      const info = data.result_info;
      // Never infer the last page from the requested size: APIs may cap it.
      // With absent/filtered totals, continue until an explicitly empty page.
      if (data.result.length === 0 || (Number.isFinite(info?.total_count) && seen.size >= info.total_count)) {
        requireThat(matches.length <= 1, `Multiple resources match ${name}; reconcile them before continuing`);
        return matches[0] ?? null;
      }
    }
    throw new Error("Cloudflare resource listing exceeded its safety bound");
  }
  async provision(options, schema, sqlTemplate, sinkToken) {
    const names = resourceNames(options.prefix);
    for (const name of [names.assets, names.raw, names.warehouse]) {
      const found = await this.request("GET", `/r2/buckets/${name}`, undefined, { optional: true });
      if (!found) await this.request("POST", "/r2/buckets", { name });
    }
    const catalog = await this.request("GET", `/basin-catalog/${names.warehouse}`, undefined, { optional: true });
    if (!catalog || catalog.result.status !== "active") await this.request("POST", `/basin-catalog/${names.warehouse}/enable`, { credential: { token: sinkToken } });
    else if (catalog.result.credential_status !== "present") await this.request("POST", `/basin-catalog/${names.warehouse}/credential`, { token: sinkToken });
    const kv = await this.named("/storage/kv/namespaces", names.oauthKV, "title") ?? (await this.request("POST", "/storage/kv/namespaces", { title: names.oauthKV })).result;
    const k2 = await this.named("/k2/streams", names.k2) ?? (await this.request("POST", "/k2/streams", { name: names.k2, retention_seconds: 604800, http: { enabled: false, authentication: true, cors: { origins: [] } }, worker_binding: { enabled: true } })).result;
    requireThat(k2.worker_binding?.enabled === true && k2.http?.enabled === false, "Existing K2 stream must have only its Workers producer enabled");
    requireThat(k2.retention_seconds === 604800, "Existing K2 stream retention differs from seven days; reconcile it before deploying");
    // This endpoint is idempotent for a subscription with the same name/settings.
    const subscription = (await this.request("POST", "/subscriptions", { name: names.subscription, start_at: { type: "earliest" } }, { k2Id: k2.id })).result;
    const stream = await this.named("/pipelines/v1/streams", names.stream) ?? (await this.request("POST", "/pipelines/v1/streams", { name: names.stream, schema, format: { type: "json" }, http: { enabled: false, authentication: true }, worker_binding: { enabled: true } })).result;
    const signature = value => JSON.stringify(value.fields.map(f => ({ name: f.name, type: f.type, required: f.required === true })).sort((a, b) => a.name.localeCompare(b.name)));
    requireThat(stream.worker_binding?.enabled === true && stream.http?.enabled === false && stream.schema && signature(stream.schema) === signature(schema), "Existing Basin stream configuration differs; use a new prefix or reconcile it");
    const sink = await this.named("/pipelines/v1/sinks", names.sink) ?? (await this.request("POST", "/pipelines/v1/sinks", { name: names.sink, type: "basin_catalog", format: { type: "parquet", compression: "zstd" }, schema, config: { account_id: options.accountId, bucket: names.warehouse, namespace: "default", table_name: "youtube_reports", token: sinkToken, rolling_policy: { interval_seconds: 60 } } })).result;
    requireThat(["basin_catalog", "r2_data_catalog"].includes(sink.type) && sink.config?.bucket === names.warehouse && sink.config?.table_name === "youtube_reports" && (sink.config?.namespace ?? "default") === "default" && sink.config?.account_id === options.accountId, "Existing Basin sink points to a different table/account");
    requireThat(sink.config?.rolling_policy?.interval_seconds === 60, "Existing Basin sink roll interval differs from 60 seconds; reconcile it before deploying");
    const sql = sqlTemplate.replaceAll("youtube_reports_stream", names.stream).replaceAll("youtube_reports_sink", names.sink);
    const pipeline = await this.named("/pipelines/v1/pipelines", names.pipeline) ?? (await this.request("POST", "/pipelines/v1/pipelines", { name: names.pipeline, sql })).result;
    requireThat(pipeline.sql?.trim() === sql.trim(), "Existing pipeline SQL differs; reconcile it before deploying");
    return { accountId: options.accountId, prefix: options.prefix, kvId: kv.id, k2Id: k2.id, subscriptionId: subscription.id, streamId: stream.id, sinkId: sink.id, pipelineId: pipeline.id, names };
  }
}
async function writeJSON(path, value) {
  const tmp = `${path}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(value, null, 2) + "\n", { mode: 0o600 });
  await rename(tmp, path);
}
export async function main(argv = process.argv.slice(2)) {
  const options = optionsFrom(argv);
  if (options.help) {
    console.log("Usage: npm run setup -- --account-id ACCOUNT --origin https://PREFIX.SUBDOMAIN.workers.dev --owner-sub GOOGLE_SUB [--prefix NAME-poc] [--apply]\nDefault: show resources only. --apply provisions private PoC resources and writes wrangler.deploy.jsonc. Required environment for --apply: CLOUDFLARE_API_TOKEN, BASIN_SINK_TOKEN, K2_CONSUME_TOKEN.");
    return;
  }
  const names = resourceNames(options.prefix);
  if (!options.apply) { console.log(JSON.stringify({ accountId: options.accountId, worker: options.prefix, origin: options.origin, resources: names, googleCallback: `${options.origin}/oauth/callback`, mcp: `${options.origin}/mcp`, willCreateApiTokens: false, willPublishYouTube: false }, null, 2)); return; }
  for (const key of ["CLOUDFLARE_API_TOKEN", "BASIN_SINK_TOKEN", "K2_CONSUME_TOKEN"]) requireThat(process.env[key], `Load ${key} securely into the environment before applying setup`);
  const schema = JSON.parse(await readFile(resolve(project, "infra/analytics-stream.schema.json"), "utf8"));
  const sql = await readFile(resolve(project, "infra/analytics-pipeline.sql"), "utf8");
  const setup = new CloudflareSetup(options.accountId, process.env.CLOUDFLARE_API_TOKEN, process.env.K2_CONSUME_TOKEN);
  const resources = await setup.provision(options, schema, sql, process.env.BASIN_SINK_TOKEN);
  const config = deploymentConfig(await loadBase(), options, resources);
  validateDeployment(config);
  await writeJSON(resolve(project, ".poc-resources.json"), resources);
  await writeJSON(resolve(project, "wrangler.deploy.jsonc"), config);
  console.log("Provisioned private PoC resources. Wrote wrangler.deploy.jsonc and .poc-resources.json without secrets. Next: deploy, provision Worker secrets, then run the smoke test in README.md.");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
