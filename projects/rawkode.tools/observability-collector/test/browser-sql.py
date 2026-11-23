"""Offline semantic SQL checks. Requires DuckDB and Bun; no network or credentials.

BUN_BIN=/path/to/bun python test/browser-sql.py
DuckDB adapters cover documented json_get_str/int and timestamp parsing only;
this checks relational semantics, not live Basin compatibility or deployment.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import duckdb

root = Path(__file__).resolve().parents[1]
fixture = json.loads(subprocess.check_output(
    [os.environ.get("BUN_BIN", "bun"), str(root / "test/browser-sql-fixture.ts")], text=True))
db = duckdb.connect()
db.execute("CREATE SCHEMA analytics")
db.execute("CREATE TABLE analytics_events(value JSON)")
db.execute("CREATE TABLE analytics.events_archive(event_time TIMESTAMP, value JSON)")
for event in fixture["events"]:
    db.execute("INSERT INTO analytics_events VALUES (?)", [json.dumps(event)])
    db.execute("INSERT INTO analytics.events_archive VALUES (?,?)", [event["time"], json.dumps(event)])

def adapt(sql):
    def getter(match):
        kind, arguments = match.groups()
        keys = re.findall(r"'([^']+)'", arguments)
        path = "$." + ".".join(keys)
        if kind == "str":
            return f"CASE WHEN json_type(value, '{path}') = 'VARCHAR' THEN json_extract_string(value, '{path}') ELSE '' END"
        return f"CASE WHEN json_type(value, '{path}') IN ('BIGINT','UBIGINT') THEN CAST(json_extract(value, '{path}') AS BIGINT) ELSE 0 END"
    return re.sub(r"json_get_(str|int)\(value, ([^)]+)\)", getter, sql)

db.execute("CREATE MACRO to_timestamp_millis(value) AS CAST(value AS TIMESTAMP)")
select = re.sub(r"^INSERT INTO \w+\s+", "", fixture["sql"])
db.execute("CREATE TABLE analytics.browser_events_v1 AS " + adapt(select))
db.execute("ALTER TABLE analytics.browser_events_v1 ADD COLUMN __ingest_ts TIMESTAMP DEFAULT TIMESTAMP '2026-11-12 12:01:00'")

def rows(name):
    cursor = db.execute(adapt(fixture["queries"][name]))
    return [dict(zip([column[0] for column in cursor.description], row)) for row in cursor.fetchall()]

def parity():
    return rows("parity")[0]

initial = parity()
assert initial == dict(archive_deliveries=3, typed_deliveries=3, archive_projections=2, typed_projections=2,
    missing_typed=0, unexpected_typed=0, archive_conflicts=0, typed_conflicts=0, archive_invalid=0, typed_invalid=0), initial
assert sum(row["events"] for row in rows("traffic")) == 2
assert sum(row["authenticated_users"] for row in rows("traffic")) == 1
assert rows("pages") == [dict(url_host="rawkode.academy", url_path="/watch", referrer_host="example.com", page_views=1, sessions=1)]
assert any(row["first_touch_utm_source"] == "first" and row["last_touch_utm_campaign"] == "last" for row in rows("campaigns"))
# Same counts and IDs, wrong projected attribution: must fail.
db.execute("UPDATE analytics.browser_events_v1 SET first_touch_utm_source='wrong' WHERE event_id='one'")
assert parity()["missing_typed"] == 1 and parity()["unexpected_typed"] == 1
# A conflicting same-ID delivery cannot be silently canonicalized as healthy.
db.execute("INSERT INTO analytics.browser_events_v1 SELECT * REPLACE ('conflicting' AS url_path) FROM analytics.browser_events_v1 WHERE event_id='two'")
assert parity()["typed_conflicts"] == 1
# An invalid session fails independently of row counts.
db.execute("UPDATE analytics.browser_events_v1 SET session_id='' WHERE event_id='two'")
assert parity()["typed_invalid"] == 2
# Missing and substituted identities must fail even if totals match.
db.execute("UPDATE analytics.browser_events_v1 SET event_id='substitute' WHERE event_id='two'")
assert parity()["missing_typed"] >= 1 and parity()["unexpected_typed"] >= 1
# Entire missing day remains empty evidence, never healthy.
db.execute("DELETE FROM analytics.browser_events_v1")
assert parity()["typed_projections"] == 0 and parity()["missing_typed"] == 2
# Sinks must only accept numeric schema v1; malformed versions remain excluded.
assert len(db.execute(adapt(select)).fetchall()) == 3
print("Browser SQL fixtures passed: projection/routing, sparse data, duplicates, identity, attribution, corruption, conflicts, invalid sessions and empty typed evidence; all four queries executed")

# Exercise the real read-only CLI with a fake SQL transport; no live fetches.
import stat
import tempfile
with tempfile.TemporaryDirectory() as temporary:
    receipt = Path(temporary) / "receipt.json"
    good = dict(initial)
    payload = json.dumps(good)
    script = """
const good=GOOD;
globalThis.fetch=async (_url, init) => {
 const sql=JSON.parse(init.body).query;
 if (process.env.FIXTURE_ERROR === '1') return Response.json({errors:[{message:'test-token-must-not-appear'}]},{status:403});
 const rows=sql.includes('AS archive_deliveries') ? [{...good,
   ...(process.env.FIXTURE_EMPTY === '1' && sql.includes('2026-11-11T') && !sql.includes('2026-11-13T') ? {archive_deliveries:0,archive_projections:0,typed_deliveries:0,typed_projections:0}: {})}] : [];
 return Response.json({rows});
};
await import(MODULE);
""".replace("GOOD", payload).replace("MODULE", json.dumps(str(root / "basin/browser-report.ts")))
    env = {**os.environ, "CLOUDFLARE_ACCOUNT_ID": "fixture", "BASIN_SQL_TOKEN": "test-token-must-not-appear",
           "BROWSER_START": "2026-11-11", "BROWSER_END": "2026-11-13", "BROWSER_REPORT": str(receipt)}
    def cli(**changes):
        result = subprocess.run([os.environ.get("BUN_BIN", "bun"), "-e", script], env={**env, **changes}, text=True, capture_output=True)
        assert "test-token-must-not-appear" not in result.stdout + result.stderr
        return result
    assert cli().returncode == 0
    assert stat.S_IMODE(receipt.stat().st_mode) == 0o600
    report = json.loads(receipt.read_text())
    assert report["projection_parity_passed"] and report["cutover_ready"] is False
    assert cli().returncode == 2  # refuse overwrite
    receipt.unlink()
    assert cli(FIXTURE_EMPTY="1").returncode == 1
    report = json.loads(receipt.read_text())
    assert report["projection_parity_passed"] is False and not report["reports"]
    receipt.unlink()
    assert cli(FIXTURE_ERROR="1").returncode == 2 and not receipt.exists()
print("Browser CLI fixtures passed: per-day empty evidence blocks reports, private/no-overwrite receipt, safe errors, cutover remains false")
