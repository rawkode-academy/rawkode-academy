# Run through `cuenv task import-posthog`; flake.nix provides Python, PyIceberg,
# pyiceberg-core and PyArrow.
"""Import PostHog history into analytics.events_archive (issue #1634).

Basin has no events before November 2026. This copies PostHog project 12084
from 1 December 2023 up to the day Basin took over each event family, as
CloudEvents shaped like the rows in analytics.events_archive:

  event_id, event_source, event_type, event_time, value (the CloudEvent JSON)

- Names: basin/posthog-mapping.json maps every PostHog event name to a
  CloudEvents source and type, or excludes it with a named rule. Any name it
  doesn't list stops the import before anything is fetched.
- IDs: an event the collector sent keeps its CloudEvent ID (cloudevents_id);
  every other event uses its PostHog UUID. The import is keyed on that ID:
  rows already in events_archive are skipped, so re-runs add nothing twice.
- Overlap: only events before their family's cutoff are taken, and events
  whose ID is already in events_archive are skipped.
- Junk: excluded names, development and preview hosts, and the July 2025
  ad-network spike are dropped by the rules below, counted per rule.
- Bots: everything else is kept and labelled `bot` / `botreason` by the
  collector's rules (src/bot-rules.json) and the stored signals, with
  `botbackfill: "posthog-import"`.
- Privacy: properties are cleaned as the collector cleans browser events:
  credentials, emails, raw user agents, IPs, person-profile updates and
  city-level location are dropped, and URLs lose their query strings.

Dry run by default: fetches everything, applies every rule, and prints the
per-month reconciliation without writing. --apply creates the table if needed,
appends month by month, then re-reads the table and fails if any month and
event differs from the expected count by more than 0.5%. The report is also
written to $GITHUB_STEP_SUMMARY when set.

Never log a credential.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ACCOUNT = "0aeb879de8e3cdde5fb3d413025222ce"
BUCKET = "rawkode-analytics"
NAMESPACE = "analytics"
TABLE = "events_archive"
PRODUCTION_HOST = "rawkode.academy"
START = datetime(2023, 12, 1, tzinfo=timezone.utc)
PAGE_SIZE = 5_000
TOLERANCE = 0.005
BACKFILL = "posthog-import"

HERE = Path(__file__).resolve().parent
MAPPING = json.loads((HERE / "posthog-mapping.json").read_text())
BOT_RULES = json.loads((HERE.parent / "src" / "bot-rules.json").read_text())

# The July/August 2025 spike: ad-network and lock-screen traffic (Glance,
# Taboola, doubleclick, newsbytes, 1weather) landing on the site, 10 July to
# 4 August 2025, mostly without a referrer. Browser events in that window from
# a PostHog person first seen inside it are dropped; people who visited
# before it are kept.
SPIKE_START = datetime(2025, 7, 10, tzinfo=timezone.utc)
SPIKE_END = datetime(2025, 8, 5, tzinfo=timezone.utc)

DEV_HOST = re.compile(
	r"^(localhost|127\.0\.0\.1)(:\d+)?$|\.workers\.dev$|\.pages\.dev$|\.deno\.dev$"
)

# --- Bot labels: the collector's rules (src/events.ts) ----------------------

BOT_PATTERN = re.compile(BOT_RULES["userAgentPattern"], re.IGNORECASE)
HOSTING_ASNS = {entry["asn"] for entry in BOT_RULES["hostingAsns"]}


def user_agent_verdict(ua: str) -> tuple[str | None, str | None, str | None]:
	"""(device, browser, reason) for a browser's user agent, as userAgentVerdict."""
	if ua.strip() == "" or BOT_PATTERN.search(ua):
		return "bot", None, "ua-pattern"
	if not re.match(r"^Mozilla/5\.0 ", ua):
		return "bot", None, "non-browser-ua"
	if re.search(r"iPad|Tablet", ua, re.IGNORECASE):
		device = "tablet"
	elif re.search(r"Mobi|Android|iPhone", ua, re.IGNORECASE):
		device = "mobile"
	else:
		device = "desktop"
	if "Edg/" in ua:
		browser = "edge"
	elif "OPR/" in ua:
		browser = "opera"
	elif "Firefox/" in ua:
		browser = "firefox"
	elif "Chrome/" in ua:
		browser = "chrome"
	elif "Safari/" in ua:
		browser = "safari"
	else:
		browser = "other"
	if browser == "other" and device == "desktop":
		return "bot", None, "desktop-no-browser"
	return device, browser, None


# --- Cleaning: the collector's clean() (src/web-events.ts) ------------------

SENSITIVE = re.compile(
	r"password|passwd|token|secret|authorization|cookie|email|user.?agent", re.IGNORECASE
)
EMAIL = re.compile(r"[^\s@]+@[^\s@]+\.[^\s@]+")
# Person-profile updates, IPs, city-level location and SDK bookkeeping.
DROPPED_KEYS = re.compile(
	r"^(\$set|\$set_once|\$unset|set_properties|set_once_properties|\$ip|\$raw_user_agent"
	r"|\$geoip_(city|postal|subdivision|latitude|longitude|time_zone|accuracy|disable)"
	r"|\$feature|\$active_feature_flags|\$sdk_debug|\$transformations|\$session_recording"
	r"|\$replay|\$console_log|\$autocapture_disabled|\$dead_clicks_enabled"
	r"|\$exception_capture|\$web_vitals_enabled|\$web_vitals_allowed|\$configured_session"
	r"|\$config_defaults|\$lib_custom_api_host|\$process_person_profile|\$sent_at|\$insert_id"
	r"|\$time$|\$elements|\$exception_list|\$cymbal|\$exception_fingerprint)"
)
REDACTED_PATH = re.compile(
	r"(/(?:reset-password|reset|verify-email|verify|magic-link|callback))(/.*)$", re.IGNORECASE
)


def page_path(path: str) -> str:
	return REDACTED_PATH.sub(r"\1/[redacted]", path)


def http_url(value: str):
	if len(value) > 4096:
		return None
	try:
		parsed = urlsplit(value)
	except ValueError:
		return None
	if parsed.scheme in ("http", "https") and parsed.netloc:
		return parsed
	return None


def clean(value, depth: int = 0, limit: int = 512):
	if depth > 3:
		return None
	if value is None or isinstance(value, bool):
		return value
	if isinstance(value, (int, float)):
		return value if value == value and value not in (float("inf"), float("-inf")) else None
	if isinstance(value, str):
		if EMAIL.search(value):
			return "[redacted]"
		parsed = http_url(value)
		if parsed:
			return f"{parsed.scheme}://{parsed.netloc}{page_path(parsed.path)}"
		value = re.sub(
			r"https?://[^\s\"'<>]+",
			lambda m: (
				f"{p.scheme}://{p.netloc}{page_path(p.path)}" if (p := http_url(m.group(0))) else "[redacted]"
			),
			value,
		)
		return re.sub(r"Bearer\s+\S+", "Bearer [redacted]", value, flags=re.IGNORECASE)[:limit]
	if isinstance(value, list):
		return [clean(item, depth + 1) for item in value[:20]]
	if isinstance(value, dict):
		out = {}
		for key, entry in list(value.items())[:200 if depth == 0 else 50]:
			if SENSITIVE.search(key) or DROPPED_KEYS.match(key) or key in ("__proto__", "constructor"):
				continue
			if re.fullmatch(r"(search_?)?query", key, re.IGNORECASE):
				if isinstance(entry, str):
					out[f"{key}_length"] = len(entry)
				continue
			cleaned = clean(entry, depth + 1, 4096 if key == "stack" else 512)
			if cleaned is not None or entry is None:
				out[key[:128]] = cleaned
		return out
	return None


# --- Transformation ---------------------------------------------------------


@dataclass
class Row:
	uuid: str
	event: str
	timestamp: datetime
	distinct_id: str
	person_id: str
	properties: dict


def parse_time(value: str) -> datetime:
	parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
	if parsed.tzinfo is None:
		parsed = parsed.replace(tzinfo=timezone.utc)
	return parsed.astimezone(timezone.utc)


def target(row: Row) -> dict:
	"""The mapping entry for a row; raises for an unmapped name."""
	by_source = MAPPING["bySource"].get(row.event)
	if by_source:
		entry = by_source.get(row.properties.get("cloudevents_source"))
		if entry:
			return entry
	entry = MAPPING["events"].get(row.event)
	if entry is None:
		raise KeyError(row.event)
	return entry


def is_browser_sdk(props: dict) -> bool:
	return props.get("$lib") == "web"


def server_data(props: dict) -> dict:
	"""CloudEvent data for an event the collector or a server sent."""
	flattened = {k[5:]: v for k, v in props.items() if k.startswith("data.")}
	if flattened:
		return flattened
	return {
		k: v
		for k, v in props.items()
		if not k.startswith("$")
		and not k.startswith("cloudevents_")
		and k not in ("bot", "botreason", "device", "browser", "asn", "country", "continent", "referrer")
	}


def browser_data(row: Row) -> dict:
	props = row.properties
	data: dict = {
		"schema_version": 0,
		"event": row.event,
		"anonymous_id": props.get("$device_id") or row.distinct_id,
		"distinct_id": row.distinct_id,
	}
	if props.get("$session_id"):
		data["session_id"] = props["$session_id"]
	current = http_url(props.get("$current_url") or "")
	if current:
		data["url_host"] = current.netloc
		data["url_path"] = page_path(current.path)
	elif props.get("$host"):
		data["url_host"] = props["$host"]
		if props.get("$pathname"):
			data["url_path"] = page_path(props["$pathname"])
	referring = props.get("$referring_domain")
	if referring and referring != "$direct":
		data["referrer_host"] = referring
	for key in ("utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"):
		value = props.get(key)
		if isinstance(value, str) and value and len(value) <= 128 and not EMAIL.search(value):
			data[key] = value
	data["properties"] = {k: v for k, v in props.items() if not k.startswith("$")}
	return data


def bot_label(row: Row, data: dict, extensions: dict) -> str | None:
	props = row.properties
	# A verdict the sender stored wins; bot = false still gets the rules below.
	if props.get("bot") is True and isinstance(props.get("botreason"), str):
		return props["botreason"][:64]
	if is_browser_sdk(props) and data.get("url_host") != PRODUCTION_HOST:
		return "non-production"
	if data.get("is_bot") is True:
		return "ua-pattern"
	ua = props.get("$raw_user_agent")
	if isinstance(ua, str):
		device, browser, reason = user_agent_verdict(ua)
		if device and device != "bot":
			extensions["device"] = device
		if browser:
			extensions["browser"] = browser
		if reason:
			return reason
	device = extensions.get("device") or data.get("device")
	browser = extensions.get("browser") or data.get("browser")
	if device == "desktop" and browser == "other":
		return "desktop-no-browser"
	if isinstance(extensions.get("asn"), int) and extensions["asn"] in HOSTING_ASNS:
		return "hosting-asn"
	return None


def to_cloud_event(row: Row, entry: dict) -> tuple[str, dict]:
	props = row.properties
	event_id = props.get("cloudevents_id") or row.uuid
	data = browser_data(row) if is_browser_sdk(props) else server_data(props)
	extensions: dict = {}
	for key in ("device", "browser", "country", "continent"):
		value = props.get(key)
		if isinstance(value, str) and value:
			extensions[key] = value
	if "country" not in extensions and props.get("$geoip_country_code"):
		extensions["country"] = props["$geoip_country_code"]
	if "continent" not in extensions and props.get("$geoip_continent_code"):
		extensions["continent"] = props["$geoip_continent_code"]
	if isinstance(props.get("asn"), int):
		extensions["asn"] = props["asn"]
	referrer = http_url(props.get("referrer") or props.get("$referrer") or "")
	if referrer:
		extensions["referrer"] = f"{referrer.scheme}://{referrer.netloc}"
	reason = bot_label(row, data, extensions)
	data = clean(data) or {}
	data["posthog"] = {
		"uuid": row.uuid,
		"event": row.event,
		"distinct_id": row.distinct_id,
		"person_id": row.person_id,
		# data.* keys are already unflattened into data.
		"properties": clean({k: v for k, v in props.items() if not k.startswith("data.")}) or {},
	}
	event = {
		"specversion": "1.0",
		"id": event_id,
		"source": entry["source"],
		"type": entry["type"],
		"time": row.timestamp.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
		"datacontenttype": "application/json",
		**extensions,
		"bot": reason is not None,
		**({"botreason": reason} if reason else {}),
		"botbackfill": BACKFILL,
		"data": data,
	}
	return event_id, event


def cutoff(family: str) -> datetime | None:
	value = MAPPING["families"][family]["cutoff"]
	return parse_time(value) if value else None


def decide(row: Row, entry: dict, returning: set[str], archived: set[str], imported: set[str]):
	"""(rule, None) for a dropped or skipped row, or (None, (event_id, event))."""
	if "exclude" in entry:
		return entry["exclude"], None
	limit = cutoff(entry["family"])
	if limit is None:
		return "family-cutoff-not-set", None
	if row.timestamp >= limit:
		return "after-dual-run-start", None
	props = row.properties
	if is_browser_sdk(props):
		host = props.get("$host") or ""
		if DEV_HOST.search(host):
			return "dev-or-preview-host", None
		if SPIKE_START <= row.timestamp < SPIKE_END and row.distinct_id not in returning:
			return "july-2025-spike", None
	event_id = props.get("cloudevents_id") or row.uuid
	if event_id in archived:
		return "already-in-archive", None
	if event_id in imported:
		return "already-imported", None
	return None, to_cloud_event(row, entry)


# --- PostHog query API ------------------------------------------------------


class PostHog:
	def __init__(self) -> None:
		self.key = os.environ.get("POSTHOG_PERSONAL_API_KEY") or sys.exit(
			"POSTHOG_PERSONAL_API_KEY is not set"
		)
		self.project = os.environ.get("POSTHOG_PROJECT_ID", "12084")
		self.host = os.environ.get("POSTHOG_HOST", "https://eu.posthog.com").rstrip("/")
		self.queries = 0

	def query(self, sql: str) -> list[list]:
		body = json.dumps({"query": {"kind": "HogQLQuery", "query": sql}}).encode()
		for attempt in range(8):
			request = urllib.request.Request(
				f"{self.host}/api/projects/{self.project}/query/",
				data=body,
				headers={"Authorization": f"Bearer {self.key}", "Content-Type": "application/json"},
				method="POST",
			)
			try:
				with urllib.request.urlopen(request, timeout=300) as response:
					self.queries += 1
					return json.loads(response.read())["results"]
			except urllib.error.HTTPError as error:
				if error.code not in (429, 500, 502, 503, 504):
					detail = error.read()[:500].decode(errors="replace")
					sys.exit(f"PostHog query failed ({error.code}): {detail}")
				wait = int(error.headers.get("Retry-After") or 0) or min(600, 15 * 2**attempt)
			except (urllib.error.URLError, TimeoutError):
				wait = min(600, 15 * 2**attempt)
			print(f"  PostHog busy, retrying in {wait}s", flush=True)
			time.sleep(wait)
		sys.exit("PostHog query failed after retries")


def sql_time(value: datetime) -> str:
	return f"toDateTime64('{value.strftime('%Y-%m-%d %H:%M:%S.%f')}', 6, 'UTC')"


def sql_list(values) -> str:
	return ", ".join("'" + v.replace("\\", "\\\\").replace("'", "\\'") + "'" for v in values)


def months(start: datetime, end: datetime):
	current = start
	while current < end:
		following = (
			current.replace(year=current.year + 1, month=1)
			if current.month == 12
			else current.replace(month=current.month + 1)
		)
		yield current, min(following, end)
		current = following


def counts(posthog: PostHog, start: datetime, end: datetime) -> Counter:
	results = posthog.query(
		f"SELECT event, count() FROM events WHERE timestamp >= {sql_time(start)}"
		f" AND timestamp < {sql_time(end)} GROUP BY event LIMIT 10000"
	)
	return Counter({event: int(n) for event, n in results})


def fetch(posthog: PostHog, start: datetime, end: datetime, names: list[str]):
	"""Every event with one of `names` in [start, end), in (timestamp, uuid) order."""
	after: tuple[str, str] | None = None
	while True:
		page = (
			f" AND (timestamp > {sql_time(parse_time(after[0]))}"
			f" OR (timestamp = {sql_time(parse_time(after[0]))} AND uuid > toUUID('{after[1]}')))"
			if after
			else ""
		)
		rows = posthog.query(
			"SELECT uuid, event, timestamp, distinct_id, person_id, properties FROM events"
			f" WHERE timestamp >= {sql_time(start)} AND timestamp < {sql_time(end)}"
			f" AND event IN ({sql_list(names)}){page}"
			f" ORDER BY timestamp, uuid LIMIT {PAGE_SIZE}"
		)
		for uuid, event, timestamp, distinct_id, person_id, properties in rows:
			props = json.loads(properties) if isinstance(properties, str) else (properties or {})
			yield Row(
				str(uuid), event, parse_time(str(timestamp)), str(distinct_id), str(person_id or ""), props
			)
		if len(rows) < PAGE_SIZE:
			return
		last = rows[-1]
		after = (str(last[2]), str(last[0]))


def returning_people(posthog: PostHog) -> set[str]:
	results = posthog.query(
		"SELECT DISTINCT distinct_id FROM events"
		f" WHERE timestamp >= {sql_time(START)} AND timestamp < {sql_time(SPIKE_START)}"
		" AND properties.$lib = 'web' LIMIT 50000"
	)
	if len(results) >= 50_000:
		sys.exit("Too many people before the spike to load in one query")
	return {str(row[0]) for row in results}


# --- Iceberg ----------------------------------------------------------------


def catalog():
	from pyiceberg.catalog.rest import RestCatalog

	token = os.environ.get("BASIN_CATALOG_TOKEN")
	if not token:
		sys.exit("BASIN_CATALOG_TOKEN is not set")
	if os.environ.get("CLOUDFLARE_ACCOUNT_ID") != ACCOUNT:
		sys.exit("Unexpected Cloudflare account")
	return RestCatalog(
		"r2",
		uri=f"https://catalog.cloudflarestorage.com/{ACCOUNT}/{BUCKET}",
		warehouse=f"{ACCOUNT}_{BUCKET}",
		token=token,
	)


def ids(table, where=None) -> set[str]:
	scan = table.scan(selected_fields=("event_id",), **({"row_filter": where} if where else {}))
	return {value for value in scan.to_arrow().column("event_id").to_pylist() if value}


def to_arrow(events: list[dict], table):
	"""Rows in the table's own columns: the five the pipeline writes, plus
	__ingest_ts (now, the real ingestion time)."""
	import pyarrow as pa

	events = sorted(events, key=lambda event: event["time"])
	times = [parse_time(e["time"]).replace(tzinfo=None) for e in events]
	ingested = datetime.now(timezone.utc).replace(tzinfo=None)
	values = {
		"event_id": [e["id"] for e in events],
		"event_type": [e["type"] for e in events],
		"event_source": [e["source"] for e in events],
		"event_time": times,
		"value": [json.dumps(e, separators=(",", ":"), ensure_ascii=False) for e in events],
		"__ingest_ts": [ingested] * len(events),
	}
	target = table.schema().as_arrow()
	unknown = [field.name for field in target if field.name not in values]
	if unknown and any(not field.nullable for field in target if field.name in unknown):
		sys.exit(f"{TABLE} has required columns the importer does not fill: {unknown}")
	arrays = [
		pa.array(values[field.name], field.type) if field.name in values else pa.nulls(len(events), field.type)
		for field in target
	]
	return pa.table(arrays, schema=target)


def stored_counts(table, end: datetime) -> Counter:
	"""Rows in the table per (month, source.type), before `end`."""
	from pyiceberg.expressions import LessThan

	rows = table.scan(
		selected_fields=("event_source", "event_type", "event_time"),
		row_filter=LessThan("event_time", end.replace(tzinfo=None).isoformat()),
	).to_arrow().to_pylist()
	return Counter(
		(row["event_time"].strftime("%Y-%m"), f"{row['event_source']}.{row['event_type']}") for row in rows
	)


# --- Run --------------------------------------------------------------------


def month_key(value: datetime) -> str:
	return value.strftime("%Y-%m")


def main(argv: list[str]) -> None:
	apply = "--apply" in argv
	now = datetime.now(timezone.utc)
	end = max((cutoff(f) for f in MAPPING["families"] if cutoff(f)), default=now)
	print(f"{'Applying' if apply else 'Dry run'}: PostHog events from {START.date()} to {end.isoformat()}")
	for family, config in MAPPING["families"].items():
		print(f"  {family}: before {config['cutoff'] or 'not set: skipped'}")

	posthog = PostHog()
	plan = [(s, e, counts(posthog, s, e)) for s, e in months(START, end)]
	totals = sum((c for _, _, c in plan), Counter())
	unmapped = sorted(name for name in totals if name not in MAPPING["events"] and name not in MAPPING["bySource"])
	if unmapped:
		sys.exit("Unmapped PostHog events (add them to basin/posthog-mapping.json):\n  " + "\n  ".join(unmapped))

	lake = catalog()
	table = lake.load_table((NAMESPACE, TABLE))
	archived = imported = ids(table)
	before = stored_counts(table, end)
	snapshot = table.current_snapshot()
	print(f"{TABLE} IDs: {len(archived)}")
	if apply:
		print(f"Rollback snapshot (current before this run): {snapshot.snapshot_id if snapshot else 'none'}", flush=True)
	returning = returning_people(posthog)
	print(f"People seen before the July 2025 spike: {len(returning)}")

	dropped: Counter[str] = Counter()
	# (month, posthog event) -> PostHog count, dropped by rule, imported
	report: dict[tuple[str, str], dict] = {}
	expected: Counter[tuple[str, str]] = Counter()  # (month, source.type) -> rows

	for start, stop, month_counts in plan:
		month = month_key(start)
		fetchable = []
		for name, n in month_counts.items():
			entry = MAPPING["events"].get(name) or {}
			row = report.setdefault((month, name), {"posthog": n, "dropped": Counter(), "imported": 0})
			if "exclude" in entry and name not in MAPPING["bySource"]:
				row["dropped"][entry["exclude"]] += n
				dropped[entry["exclude"]] += n
			else:
				fetchable.append(name)
		events: dict[str, dict] = {}
		fetched: Counter[str] = Counter()
		for row in fetch(posthog, start, stop, sorted(fetchable)) if fetchable else ():
			fetched[row.event] += 1
			try:
				entry = target(row)
			except KeyError:
				sys.exit(f"Unmapped PostHog event {row.event!r} from {row.properties.get('cloudevents_source')!r}")
			rule, result = decide(row, entry, returning, archived, imported)
			line = report[(month, row.event)]
			if rule:
				line["dropped"][rule] += 1
				dropped[rule] += 1
				continue
			event_id, event = result
			if event_id in events:
				line["dropped"]["duplicate-id"] += 1
				dropped["duplicate-id"] += 1
				continue
			events[event_id] = event
			line["imported"] += 1
			expected[(month, f"{event['source']}.{event['type']}")] += 1
		short = {name: (month_counts[name], fetched[name]) for name in fetchable if fetched[name] != month_counts[name]}
		if short:
			sys.exit(f"{month}: fetched counts differ from PostHog's counts: {short}")
		print(f"{month}: {sum(month_counts.values())} in PostHog, {len(events)} to import", flush=True)
		if apply and events:
			table.append(to_arrow(list(events.values()), table))
			imported.update(events)

	print(f"PostHog queries: {posthog.queries}")
	print("Dropped or skipped, by rule:")
	for rule, n in dropped.most_common():
		print(f"  {rule}: {n}")
	print(f"{'Imported' if apply else 'Would import'}: {sum(expected.values())} events")

	mismatches = []
	if apply and table is not None:
		# Every month and event must hold what was there before plus this run.
		actual = stored_counts(table.refresh(), end)
		for key in sorted(set(actual) | set(expected) | set(before)):
			want = before[key] + expected[key]
			got = actual[key]
			if abs(got - want) > TOLERANCE * max(want, 1):
				mismatches.append((key, want, got))
		print(f"Reconciliation: {len(actual)} month/event pairs checked, {len(mismatches)} off by more than 0.5%")
	write_report(report, dropped, apply, mismatches)
	if mismatches:
		sys.exit(f"Reconciliation failed for {len(mismatches)} month/event pairs")
	if not apply:
		print("Nothing written. Re-run with --apply to commit.")


def write_report(report, dropped, apply: bool, mismatches) -> None:
	rules = sorted({rule for line in report.values() for rule in line["dropped"]})
	lines = [
		f"## PostHog import {'(applied)' if apply else '(dry run)'}",
		"",
		"| Dropped or skipped by rule | Events |",
		"| --- | ---: |",
		*[f"| {rule} | {n} |" for rule, n in dropped.most_common()],
		"",
		"| Month | PostHog event | PostHog | " + " | ".join(rules) + " | Imported |",
		"| --- | --- | ---: | " + " | ".join("---:" for _ in rules) + " | ---: |",
	]
	for (month, name), line in sorted(report.items()):
		lines.append(
			f"| {month} | `{name}` | {line['posthog']} | "
			+ " | ".join(str(line["dropped"].get(rule, "")) for rule in rules)
			+ f" | {line['imported']} |"
		)
	if mismatches:
		lines += ["", "### Reconciliation failures", "", "| Month | Event | Expected | In table |", "| --- | --- | ---: | ---: |"]
		lines += [f"| {m} | {e} | {want} | {got} |" for (m, e), want, got in mismatches]
	text = "\n".join(lines) + "\n"
	summary = os.environ.get("GITHUB_STEP_SUMMARY")
	if summary:
		with open(summary, "a") as handle:
			handle.write(text)
	path = os.environ.get("IMPORT_REPORT")
	if path:
		Path(path).write_text(text)


if __name__ == "__main__":
	# IMPORT_ARGS lets a task runner that doesn't forward arguments pass them.
	main(sys.argv[1:] or os.environ.get("IMPORT_ARGS", "").split())
