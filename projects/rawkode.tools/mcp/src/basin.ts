import { ensure, readLimited, ServiceError } from "./errors.ts";

// Read-only Basin SQL over the Academy analytics lake (bucket
// rawkode-analytics). BASIN_SQL_TOKEN is the lake's read-only SQL token.
export type BasinConfig = { accountId: string; bucket: string; token: string; fetcher?: typeof fetch };
export type Row = Record<string, string | number | boolean | null>;

export const MAX_ROWS = 500;

export function basinConfig(env: Pick<CloudflareEnv, "BASIN_ACCOUNT_ID" | "BASIN_BUCKET" | "BASIN_SQL_TOKEN">): BasinConfig {
  ensure(/^[a-f0-9]{32}$/.test(env.BASIN_ACCOUNT_ID ?? "") && env.BASIN_BUCKET && env.BASIN_SQL_TOKEN, "not_configured", "Basin SQL is not configured", 503);
  return { accountId: env.BASIN_ACCOUNT_ID, bucket: env.BASIN_BUCKET, token: env.BASIN_SQL_TOKEN };
}

// Basin doesn't document its response shape: accept rows as objects, or as
// arrays zipped with a column schema.
export function parseRows(payload: unknown): Row[] {
  const body = payload as { result?: unknown; rows?: unknown };
  const result = (body?.result ?? body) as { rows?: unknown; schema?: Array<{ name: string } | string> };
  const rows = result?.rows;
  if (!Array.isArray(rows)) return [];
  if (rows.length === 0 || !Array.isArray(rows[0])) return rows as Row[];
  const columns = (result.schema ?? []).map(column => typeof column === "string" ? column : column.name);
  return (rows as unknown[][]).map(values => Object.fromEntries(values.map((value, i) => [columns[i] ?? `col${i}`, value]))) as Row[];
}

// One statement that only reads: SELECT or WITH … SELECT, no semicolons. The
// token is read-only anyway; this keeps errors clear and queries bounded.
export function readOnlyStatement(sql: string) {
  const statement = sql.trim().replace(/;\s*$/, "");
  ensure(statement.length > 0 && statement.length <= 20000, "invalid_query", "Provide one SQL statement of at most 20,000 characters");
  ensure(!statement.includes(";"), "invalid_query", "Only one statement is allowed");
  ensure(/^(select|with)\b/i.test(statement), "invalid_query", "Only SELECT queries are allowed");
  return statement;
}

export async function basinQuery(config: BasinConfig, sql: string) {
  const fetcher = config.fetcher ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const response = await fetcher(`https://api.sql.cloudflarestorage.com/api/v1/accounts/${config.accountId}/basin-sql/query/${config.bucket}`, {
    method: "POST", redirect: "manual", signal: AbortSignal.timeout(60000),
    headers: { authorization: `Bearer ${config.token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  let payload: unknown = null;
  try { payload = JSON.parse(new TextDecoder().decode(await readLimited(response.body, 16 * 1024 * 1024))); } catch { /* reported below */ }
  if (!response.ok || (payload as { success?: boolean })?.success === false) {
    // Basin's error messages describe the query (unknown column, syntax), not
    // credentials, so they are returned to help fix the query.
    const errors = (payload as { errors?: { message?: string }[] })?.errors?.map(e => e.message).filter(Boolean).join("; ");
    throw new ServiceError("basin_query_failed", errors ? errors.slice(0, 2000) : `Basin SQL failed (HTTP ${response.status})`, response.status === 400 ? 400 : 502, response.status);
  }
  const rows = parseRows(payload);
  return { rows: rows.slice(0, MAX_ROWS), rowCount: rows.length, truncated: rows.length > MAX_ROWS };
}
