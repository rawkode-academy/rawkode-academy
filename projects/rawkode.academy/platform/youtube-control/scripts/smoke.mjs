#!/usr/bin/env node
// Live operator acceptance: analytics ingestion + a reviewed private test broadcast.
// No YouTube writes occur unless --publish is supplied. Never prints credentials.
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { requireThat, validateDeployment } from "./setup.mjs";

const project = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({ options: {
  publish: { type: "boolean", default: false },
  "tokens-file": { type: "string", default: ".poc-api-tokens.secrets.json" },
  session: { type: "string", default: "smoke-session.json" },
  "wait-seconds": { type: "string", default: "180" },
  help: { type: "boolean" },
} });
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  if (values.help) { console.log("Usage: npm run smoke -- [--publish] [--wait-seconds 180] [--session smoke-session.json] [--tokens-file PRIVATE_FILE]\nDefault: fetch real analytics, verify storage/MCP discovery and prepare a private broadcast plan. --publish also creates/updates that private test broadcast. Production session manifests are rejected."); return; }
  const config = JSON.parse(await readFile(resolve(project, "wrangler.deploy.jsonc"), "utf8"));
  validateDeployment(config);
  const tokens = JSON.parse(await readFile(resolve(project, values["tokens-file"]), "utf8"));
  requireThat(tokens.READ_API_TOKEN?.length >= 32, "Missing READ_API_TOKEN in the private tokens file");
  if (values.publish) requireThat(tokens.WRITE_API_TOKEN?.length >= 32, "--publish requires WRITE_API_TOKEN in the private tokens file");
  const timeout = Number(values["wait-seconds"]);
  requireThat(Number.isInteger(timeout) && timeout >= 0 && timeout <= 600, "--wait-seconds must be between 0 and 600");
  const origin = config.vars.PUBLIC_ORIGIN;
  async function call(path, body, write = false) {
    const response = await fetch(`${origin}${path}`, { method: body === undefined ? "GET" : "POST", redirect: "error", signal: AbortSignal.timeout(60000), headers: { authorization: `Bearer ${write ? tokens.WRITE_API_TOKEN : tokens.READ_API_TOKEN}`, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await response.json();
    requireThat(response.ok, `${path} failed (HTTP ${response.status}, code ${typeof data.error === "string" ? data.error : "unknown"})`);
    return data;
  }
  const health = await fetch(`${origin}/health`, { redirect: "error", signal: AbortSignal.timeout(15000) });
  requireThat(health.ok, "Worker health check failed");
  const mcp = await fetch(`${origin}/mcp`, { redirect: "error", signal: AbortSignal.timeout(15000) });
  requireThat(mcp.status === 401, "MCP must reject unauthenticated requests");
  const resourceMetadata = mcp.headers.get("www-authenticate")?.match(/resource_metadata="([^"]+)"/)?.[1];
  requireThat(resourceMetadata && new URL(resourceMetadata).origin === origin, "MCP did not advertise its own protected resource metadata");
  const metadataResponse = await fetch(resourceMetadata, { redirect: "error", signal: AbortSignal.timeout(15000) });
  const metadata = await metadataResponse.json();
  requireThat(metadataResponse.ok && metadata.resource === `${origin}/mcp`, "MCP protected resource URL is incorrect");
  const authorizationServer = await fetch(`${origin}/.well-known/oauth-authorization-server`, { redirect: "error", signal: AbortSignal.timeout(15000) });
  const authorizationMetadata = await authorizationServer.json();
  requireThat(authorizationServer.ok && authorizationMetadata.code_challenge_methods_supported?.includes("S256"), "MCP OAuth discovery does not advertise PKCE S256");
  console.log("MCP discovery and authentication boundary passed. Complete the browser consent check in ChatGPT as described in README.md.");
  const status = await call("/v1/status");
  requireThat(status.channelId === config.vars.YOUTUBE_CHANNEL_ID, "Worker is configured for another channel");

  // Keep analytics dates in YouTube's reporting timezone, independent of display time.
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const end = Date.parse(today) - 86400000;
  const query = { report: "daily", startDate: new Date(end - 6 * 86400000).toISOString().slice(0, 10), endDate: new Date(end).toISOString().slice(0, 10) };
  const fresh = await call("/v1/analytics/query", { ...query, refresh: true });
  requireThat(fresh.servedFrom === "youtube" && fresh.storage?.snapshotId && Array.isArray(fresh.rows), "A fresh YouTube report was not archived");
  console.log(JSON.stringify({ analytics: "archived", rows: fresh.rows.length, requestedRange: fresh.requestedRange, dataThrough: fresh.dataThrough, snapshotId: fresh.storage.snapshotId, storage: fresh.storage }, null, 2));
  if (tokens.WRITE_API_TOKEN) await call("/v1/analytics/drain", {}, true);
  const deadline = Date.now() + timeout * 1000;
  let stored;
  do {
    const result = await call("/v1/analytics/query", query);
    if (result.servedFrom === "basin" && result.storage?.warehouseVisible && result.fetchedAt >= fresh.fetchedAt) { stored = result; break; }
    if (Date.now() < deadline) await wait(Math.min(10000, deadline - Date.now()));
  } while (Date.now() < deadline);
  requireThat(stored, "Snapshot is not yet queryable in Basin. Check /v1/status and Pipeline delivery/user-error metrics, then rerun; no YouTube write was attempted");
  console.log(JSON.stringify({ analytics: "queryable_in_basin", rows: stored.rows.length, snapshotId: stored.storage.snapshotId }, null, 2));

  const sessionFile = resolve(project, values.session);
  let session;
  try { session = JSON.parse(await readFile(sessionFile, "utf8")); }
  catch (error) {
    if (error.code !== "ENOENT") throw error;
    session = { sessionId: `poc-${randomUUID()}`, title: "Rawkode Academy publishing and analytics PoC test", description: "Private deployment acceptance test. This is not a public Academy session.", scheduledStartTime: new Date(Date.now() + 86400000).toISOString(), privacyStatus: "private", madeForKids: false };
    await writeFile(sessionFile, JSON.stringify(session, null, 2) + "\n", { mode: 0o600, flag: "wx" });
  }
  requireThat(session.sessionId?.startsWith("poc-") && session.privacyStatus === "private" && session.broadcastId === undefined, "Smoke tests only accept a generated private PoC session; use the API for real session manifests");
  const plan = await call("/v1/sessions/plan", session);
  console.log(JSON.stringify({ publishing: values.publish ? "applying_private_test" : "plan_only", plan }, null, 2));
  if (!values.publish) { console.log("Analytics passed and publishing plan is ready. Rerun with --publish to exercise creation and update of this private test broadcast."); return; }
  const published = await call("/v1/sessions/apply", { planId: plan.planId }, true);
  requireThat(published.privacyStatus === "private", "Read-back did not confirm a private test broadcast");
  const updated = { ...session, description: "Private deployment acceptance test. Creation, update, and real analytics retrieval were exercised together." };
  const updatePlan = await call("/v1/sessions/plan", updated);
  const result = await call("/v1/sessions/apply", { planId: updatePlan.planId }, true);
  requireThat(result.broadcastId === published.broadcastId && result.privacyStatus === "private", "Update did not preserve broadcast identity and privacy");
  await writeFile(sessionFile, JSON.stringify(updated, null, 2) + "\n", { mode: 0o600 });
  console.log(JSON.stringify({ acceptance: "passed", broadcastUrl: result.url, visibility: "private", analyticsSource: stored.servedFrom, analyticsSnapshotId: stored.storage.snapshotId }, null, 2));
  console.log("The private test broadcast remains in YouTube Studio for inspection and manual cleanup. No stream was started.");
}
main().catch(error => { console.error(error instanceof SyntaxError ? "Invalid JSON input or response; no payload was logged" : error.message); process.exitCode = 1; });
