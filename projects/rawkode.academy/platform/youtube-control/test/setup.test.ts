import test from "node:test";
import assert from "node:assert/strict";
import { CloudflareSetup, deploymentConfig, loadBase, optionsFrom, resourceNames, validateDeployment } from "../scripts/setup.mjs";

const account = "a".repeat(32);
const argv = ["--account-id", account, "--origin", "https://youtube-control-poc.example.workers.dev", "--owner-sub", "123456789", "--prefix", "youtube-control-poc"];
const options = optionsFrom(argv);
const schema = { fields: [{ name: "report_json", type: "string", required: true }] };
const sql = "INSERT INTO youtube_reports_sink SELECT * FROM youtube_reports_stream;";

function mockCloudflare() {
  const resources = new Map<string, any>();
  const writes: { path: string; body: any }[] = [];
  let nextId = 1;
  let loseK2Reply = false;
  const fetcher = async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
    const path = url.pathname.replace(`/client/v4/accounts/${account}`, "");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const method = init?.method ?? "GET";
    const success = (result: unknown) => Response.json({ success: true, result });
    if (method === "GET" && path.startsWith("/r2/buckets/")) {
      return resources.has(path) ? success(resources.get(path)) : Response.json({ success: false }, { status: 404 });
    }
    if (method === "GET" && path.startsWith("/basin-catalog/")) {
      return resources.has(path) ? success(resources.get(path)) : Response.json({ success: false }, { status: 404 });
    }
    if (method === "GET") {
      const all = [...resources.entries()].filter(([key]) => key.startsWith(`${path}/`)).map(([, value]) => value).filter(value => !url.searchParams.has("name") || value.name?.includes(url.searchParams.get("name")));
      const page = Number(url.searchParams.get("page") ?? 1);
      const perPage = Number(url.searchParams.get("per_page") ?? 20);
      const rows = all.slice((page - 1) * perPage, page * perPage);
      return Response.json({ success: true, result: rows, result_info: { page, per_page: perPage, count: rows.length, total_count: all.length } });
    }
    assert.equal(method, "POST");
    writes.push({ path, body });
    if (path === "/r2/buckets") { const result = { name: body.name }; resources.set(`/r2/buckets/${body.name}`, result); return success(result); }
    if (path.endsWith("/enable")) { const result = { status: "active", credential_status: "present" }; resources.set(path.slice(0, -7), result); return success(result); }
    const key = path === "/subscriptions" ? `${path}/${body.name}` : `${path}/${body.name ?? body.title}`;
    const result = resources.get(key) ?? { ...body, id: (nextId++).toString(16).padStart(32, "0") };
    resources.set(key, result);
    if (path === "/k2/streams" && loseK2Reply) { loseK2Reply = false; throw new Error("Simulated response loss"); }
    return success(result);
  };
  return { resources, writes, setup: new CloudflareSetup(account, "management-secret", "consume-secret", fetcher), loseK2Reply: () => { loseK2Reply = true; } };
}

test("setup defaults to a plan and rejects ambiguous origins/owner wildcards", () => {
  assert.equal(options.apply, false);
  for (const origin of ["http://youtube-control-poc.example.workers.dev", "https://youtube-control-poc.example.workers.dev/", "https://youtube-control-poc.example.workers.dev/path", "https://evil.invalid", "https://youtube-control-poc.workers.dev"]) {
    const invalid = [...argv]; invalid[3] = origin;
    assert.throws(() => optionsFrom(invalid));
  }
  const wildcard = [...argv]; wildcard[5] = "*";
  assert.throws(() => optionsFrom(wildcard));
});

test("base placeholder config cannot accidentally be deployed", async () => {
  const base = await loadBase();
  assert.throws(() => validateDeployment(base), /Provision real resource IDs/);
});

test("setup creates private inputs, 60s Iceberg batching, then reuses matching resources", async () => {
  const mock = mockCloudflare();
  const first = await mock.setup.provision(options, schema, sql, "sink-secret");
  const originalWrites = mock.writes.length;
  const second = await mock.setup.provision(options, schema, sql, "sink-secret");
  assert.deepEqual(second, first);
  assert.equal(mock.writes.length, originalWrites + 1); // idempotent subscription create only
  for (const path of ["/k2/streams", "/pipelines/v1/streams"]) assert.equal(mock.writes.find(w => w.path === path)!.body.http.enabled, false);
  const sink = mock.writes.find(w => w.path === "/pipelines/v1/sinks")!.body;
  assert.equal(sink.config.rolling_policy.interval_seconds, 60);
  assert.equal(sink.type, "basin_catalog");
  assert.equal(sink.format.type, "parquet");
  assert.equal(JSON.stringify(first).includes("sink-secret"), false);
  const config = deploymentConfig(await loadBase(), options, first);
  validateDeployment(config);
  assert.equal(JSON.stringify(config).includes("secret"), false);
  assert.deepEqual(config.triggers.crons, ["*/5 * * * *", "17 8 * * *"]);
});

test("setup recovers a lost create response through named discovery without another stream", async () => {
  const mock = mockCloudflare();
  mock.loseK2Reply();
  await assert.rejects(mock.setup.provision(options, schema, sql, "sink-secret"), /Simulated response loss/);
  await mock.setup.provision(options, schema, sql, "sink-secret");
  assert.equal(mock.writes.filter(w => w.path === "/k2/streams").length, 1);
});

test("setup refuses to reuse an existing sink pointing at another bucket", async () => {
  const mock = mockCloudflare();
  const names = resourceNames(options.prefix);
  mock.resources.set(`/pipelines/v1/sinks/${names.sink}`, { id: "1".repeat(32), name: names.sink, type: "basin_catalog", config: { account_id: account, bucket: "unrelated", table_name: "youtube_reports" } });
  await assert.rejects(mock.setup.provision(options, schema, sql, "sink-secret"), /different table/);
});

test("Cloudflare setup errors never echo an upstream token/body", async () => {
  const setup = new CloudflareSetup(account, "secret", "secret", async () => Response.json({ success: false, errors: [{ code: 123, message: "secret echoed by upstream" }] }, { status: 403 }));
  await assert.rejects(setup.request("POST", "/example", { token: "secret" }), error => {
    assert.equal((error as Error).message.includes("secret"), false);
    assert.match((error as Error).message, /HTTP 403; codes 123/);
    return true;
  });
});

test("all five page-based discovery endpoints honor server totals even when pages are capped", async () => {
  for (const path of ["/storage/kv/namespaces", "/k2/streams", "/pipelines/v1/streams", "/pipelines/v1/sinks", "/pipelines/v1/pipelines"]) {
    const field = path.includes("/kv/") ? "title" : "name";
    const calls: number[] = [];
    const setup = new CloudflareSetup(account, "secret", "secret", async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get("page"));
      calls.push(page);
      assert.equal(url.searchParams.get("per_page"), "100");
      const rows = page === 1 ? [{ id: "a", [field]: "unrelated" }, { id: "b", [field]: "other" }] : [{ id: "c", [field]: "target" }];
      return Response.json({ success: true, result: rows, result_info: { page, per_page: 2, count: rows.length, total_count: 3 } });
    });
    assert.equal((await setup.named(path, "target", field)).id, "c");
    assert.deepEqual(calls, [1, 2]);
  }
});

test("missing pagination metadata requires a terminal empty page rather than a short page", async () => {
  const calls: number[] = [];
  const setup = new CloudflareSetup(account, "secret", "secret", async (input: string | URL | Request) => {
    const page = Number(new URL(String(input)).searchParams.get("page"));
    calls.push(page);
    return Response.json({ success: true, result: page === 1 ? [{ id: "a", name: "other" }] : page === 2 ? [{ id: "b", name: "target" }] : [] });
  });
  assert.equal((await setup.named("/k2/streams", "target")).id, "b");
  assert.deepEqual(calls, [1, 2, 3]);
});

test("nonadvancing resource pages fail closed instead of creating a duplicate", async () => {
  const setup = new CloudflareSetup(account, "secret", "secret", async () => Response.json({ success: true, result: [{ id: "a", name: "other" }], result_info: { total_count: 2 } }));
  await assert.rejects(setup.named("/k2/streams", "target"), /did not advance/);
});

test("reusing differently configured retention or Iceberg batching requires reconciliation", async () => {
  const mock = mockCloudflare();
  await mock.setup.provision(options, schema, sql, "sink-secret");
  const names = resourceNames(options.prefix);
  const k2 = mock.resources.get(`/k2/streams/${names.k2}`);
  k2.retention_seconds = 3600;
  await assert.rejects(mock.setup.provision(options, schema, sql, "sink-secret"), /retention differs/);
  k2.retention_seconds = 604800;
  const sink = mock.resources.get(`/pipelines/v1/sinks/${names.sink}`);
  sink.config.rolling_policy.interval_seconds = 300;
  await assert.rejects(mock.setup.provision(options, schema, sql, "sink-secret"), /roll interval differs/);
});

test("catalog enable and credential storage use their distinct documented payloads", async () => {
  const mock = mockCloudflare();
  await mock.setup.provision(options, schema, sql, "sink-secret");
  const names = resourceNames(options.prefix);
  assert.deepEqual(mock.writes.find(w => w.path.endsWith("/enable"))!.body, { credential: { token: "sink-secret" } });
  mock.resources.set(`/basin-catalog/${names.warehouse}`, { status: "active", credential_status: "absent" });
  await mock.setup.provision(options, schema, sql, "rotated-sink-secret");
  assert.deepEqual(mock.writes.find(w => w.path.endsWith("/credential"))!.body, { token: "rotated-sink-secret" });
});
