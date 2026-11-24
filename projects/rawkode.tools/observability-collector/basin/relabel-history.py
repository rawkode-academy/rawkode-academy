# Run through `cuenv task relabel-history`; flake.nix provides Python,
# PyIceberg, pyiceberg-core and PyArrow.
"""One-time, explicitly requested rewrite: label rows stored before bot labelling.

The collector labels every new event with `bot` and `botreason`. This rewrites
the rows already in `analytics.events_archive` and `analytics.short_links` in
place, applying the rules their stored signals allow (the same rules as
BOT_REASON and LINK_BOT_REASON in the website's src/lib/analytics/queries.ts):

- non-production      browser events from any host but rawkode.academy
- ua-pattern          the old collector's user-agent verdict (data.is_bot),
                      or a redirect whose device is "bot"
- desktop-no-browser  a desktop agent with no browser token
- unmatched-path      a redirect whose path isn't a short link or the root

Hosting networks, client hints and webdriver were never stored, so they can't
be applied here.

Archive rows gain `bot`, `botreason` (bots only) and `botbackfill` inside their
CloudEvent JSON. short_links gains `bot`, `bot_reason` and `asn` columns (asn
stays null). Rows already labelled are left as they are, so re-runs are safe.

Only rows ingested before the run starts are read and replaced, so the
archive pipeline can keep appending. Dry run by default; pass --apply to
commit. Each table's previous snapshot is printed: snapshot expiry keeps it
for 7 days, and `--rollback <table> <snapshot-id>` restores it (dropping
anything appended since).

Never log the catalog credential.
"""

from __future__ import annotations

import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone

ACCOUNT = "0aeb879de8e3cdde5fb3d413025222ce"
BUCKET = "rawkode-analytics"
NAMESPACE = "analytics"
PRODUCTION_HOST = "rawkode.academy"
BACKFILL = "2026-11-23"
TABLES = ("events_archive", "short_links")


def event_bot_reason(event: dict) -> str | None:
	data = event.get("data") if isinstance(event.get("data"), dict) else {}
	if (
		event.get("source") == "rawkode-academy-browser"
		and data.get("url_host") != PRODUCTION_HOST
	):
		return "non-production"
	if data.get("is_bot") is True:
		return "ua-pattern"
	device = event.get("device") or data.get("device")
	browser = event.get("browser") or data.get("browser")
	if device == "desktop" and browser == "other":
		return "desktop-no-browser"
	return None


def relabel_value(value: str) -> tuple[str, str | None, bool]:
	"""The relabelled JSON, its reason, and whether it changed."""
	try:
		event = json.loads(value)
	except (TypeError, ValueError):
		return value, None, False
	if not isinstance(event, dict):
		return value, None, False
	if "bot" in event:
		return value, event.get("botreason"), False
	reason = event_bot_reason(event)
	event["bot"] = reason is not None
	if reason is not None:
		event["botreason"] = reason
	event["botbackfill"] = BACKFILL
	return json.dumps(event, separators=(",", ":"), ensure_ascii=False), reason, True


def link_bot_reason(row: dict) -> str | None:
	if row.get("device") == "bot":
		return "ua-pattern"
	if row.get("device") == "desktop" and row.get("browser") == "other":
		return "desktop-no-browser"
	if row.get("matched") is False and (row.get("path") or "") != "":
		return "unmatched-path"
	return None


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


def relabel_archive(table, cutoff: str, apply: bool) -> None:
	import pyarrow as pa
	from pyiceberg.expressions import LessThan

	before = table.current_snapshot()
	rows = table.scan(row_filter=LessThan("__ingest_ts", cutoff)).to_arrow()
	values = rows.column("value").to_pylist()
	reasons: Counter[str] = Counter()
	changed = 0
	relabelled = []
	for value in values:
		new, reason, did_change = relabel_value(value)
		relabelled.append(new)
		reasons[reason or "human"] += 1
		changed += did_change
	print(f"events_archive: {len(values)} rows, {changed} to label")
	for reason, count in reasons.most_common():
		print(f"  {reason}: {count}")
	if not apply or changed == 0:
		return
	index = rows.schema.get_field_index("value")
	rows = rows.set_column(
		index, rows.schema.field(index), pa.array(relabelled, rows.column("value").type)
	)
	table.overwrite(rows, overwrite_filter=LessThan("__ingest_ts", cutoff))
	print(
		f"events_archive: committed; previous snapshot {before.snapshot_id if before else 'none'}"
	)


def relabel_links(table, cutoff: str, apply: bool) -> None:
	import pyarrow as pa
	from pyiceberg.expressions import LessThan
	from pyiceberg.types import BooleanType, LongType, StringType

	before = table.current_snapshot()
	columns = {field.name for field in table.schema().fields}
	missing = [name for name in ("bot", "bot_reason", "asn") if name not in columns]
	if missing and apply:
		with table.update_schema() as update:
			if "bot" in missing:
				update.add_column("bot", BooleanType())
			if "bot_reason" in missing:
				update.add_column("bot_reason", StringType())
			if "asn" in missing:
				update.add_column("asn", LongType())
		table = table.refresh()
	rows = table.scan(row_filter=LessThan("__ingest_ts", cutoff)).to_arrow()
	records = rows.to_pylist()
	reasons: Counter[str] = Counter()
	bots, bot_reasons = [], []
	for record in records:
		if record.get("bot") is not None:
			reason = record.get("bot_reason")
			bots.append(record["bot"])
		else:
			reason = link_bot_reason(record)
			bots.append(reason is not None)
		bot_reasons.append(reason)
		reasons[reason or "human"] += 1
	print(f"short_links: {len(records)} rows, adding columns {missing or 'none'}")
	for reason, count in reasons.most_common():
		print(f"  {reason}: {count}")
	if not apply or not records:
		return
	for name, values, kind in (
		("bot", bots, pa.bool_()),
		("bot_reason", bot_reasons, pa.string()),
	):
		index = rows.schema.get_field_index(name)
		rows = rows.set_column(
			index, rows.schema.field(index), pa.array(values, rows.column(name).type or kind)
		)
	table.overwrite(rows, overwrite_filter=LessThan("__ingest_ts", cutoff))
	print(
		f"short_links: committed; previous snapshot {before.snapshot_id if before else 'none'}"
	)


def rollback(table_name: str, snapshot_id: int) -> None:
	if table_name not in TABLES:
		sys.exit(f"Unexpected table {table_name}")
	table = catalog().load_table((NAMESPACE, table_name))
	table.manage_snapshots().set_current_snapshot(snapshot_id=snapshot_id).commit()
	print(f"{table_name}: current snapshot set to {snapshot_id}")


def main(argv: list[str]) -> None:
	if argv[:1] == ["--rollback"]:
		if len(argv) != 3:
			sys.exit("Usage: --rollback <table> <snapshot-id>")
		rollback(argv[1], int(argv[2]))
		return
	apply = "--apply" in argv
	# __ingest_ts is a timestamp without zone, in UTC.
	cutoff = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="microseconds")
	print(f"{'Applying' if apply else 'Dry run'}: rows ingested before {cutoff} UTC")
	lake = catalog()
	relabel_archive(lake.load_table((NAMESPACE, "events_archive")), cutoff, apply)
	relabel_links(lake.load_table((NAMESPACE, "short_links")), cutoff, apply)
	if not apply:
		print("Nothing written. Re-run with --apply to commit.")


if __name__ == "__main__":
	# RELABEL_ARGS lets a task runner that doesn't forward arguments pass them.
	main(sys.argv[1:] or os.environ.get("RELABEL_ARGS", "").split())
