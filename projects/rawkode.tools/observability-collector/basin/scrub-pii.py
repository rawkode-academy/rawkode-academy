# Run through `cuenv task scrub-pii`; flake.nix provides Python, PyIceberg,
# pyiceberg-core and PyArrow.
"""One-time, explicitly requested rewrite: remove personal data from archived events.

Until PR #1646, every sign-in sent `rawkode-academy-website` / `user.identified`
with the user's email and name in `data.set_properties`, and until the identity
fix every registration sent `rawkode-academy-identity` /
`auth.user_registered` with them in `data.$set`. The archive stored both. This
rewrites `analytics.events_archive` in place:

- drops `email` and `name` from `data.set_properties`,
  `data.set_once_properties`, `data.$set` and `data.$set_once` (and the
  objects themselves once empty)
- replaces any other string value that contains an email address with
  "[redacted]", wherever it is in the event

Every other field is kept, including `data.distinct_id` and `data.anon_id`,
which link anonymous IDs to users. Rows that need no change are written back
unchanged, so re-runs are safe and change nothing.

Only rows ingested before the run starts are read and replaced, so the
archive pipeline can keep appending. Run it after PR #1646 is deployed, or
rows sent in between still carry the fields. Dry run by default; pass --apply
to commit. The previous snapshot is printed: snapshot expiry keeps it for
7 days, and `--rollback <snapshot-id>` restores it (dropping anything appended
since). Rolling back restores the personal data too.

Never log the catalog credential or a matched value.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone

ACCOUNT = "0aeb879de8e3cdde5fb3d413025222ce"
BUCKET = "rawkode-analytics"
NAMESPACE = "analytics"
TABLE = "events_archive"
PROFILE_KEYS = ("set_properties", "set_once_properties", "$set", "$set_once")
PERSONAL_KEYS = ("email", "name")
EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")
REDACTED = "[redacted]"


def redact(node, path: str, found: Counter) -> object:
	"""The node with email-like strings redacted, counting each path."""
	if isinstance(node, str):
		if EMAIL.search(node):
			found[f"email-value:{path}"] += 1
			return REDACTED
		return node
	if isinstance(node, list):
		return [redact(item, f"{path}[]", found) for item in node]
	if isinstance(node, dict):
		return {key: redact(value, f"{path}.{key}", found) for key, value in node.items()}
	return node


def scrub_event(event: dict) -> tuple[dict, Counter]:
	"""The scrubbed event and what was removed, by rule and path."""
	found: Counter[str] = Counter()
	data = event.get("data")
	if isinstance(data, dict):
		data = dict(data)
		for profile in PROFILE_KEYS:
			properties = data.get(profile)
			if not isinstance(properties, dict):
				continue
			kept = {k: v for k, v in properties.items() if k not in PERSONAL_KEYS}
			for key in properties.keys() - kept.keys():
				found[f"profile-field:data.{profile}.{key}"] += 1
			if kept:
				data[profile] = kept
			else:
				del data[profile]
		event = {**event, "data": data}
	return redact(event, "$", found), found


def scrub_value(value: str) -> tuple[str, Counter, bool]:
	"""The scrubbed JSON, what was removed, and whether it changed."""
	try:
		event = json.loads(value)
	except (TypeError, ValueError):
		return value, Counter(), False
	if not isinstance(event, dict):
		return value, Counter(), False
	scrubbed, found = scrub_event(event)
	if not found:
		return value, found, False
	return json.dumps(scrubbed, separators=(",", ":"), ensure_ascii=False), found, True


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


def scrub_archive(table, cutoff: str, apply: bool) -> None:
	import pyarrow as pa
	from pyiceberg.expressions import LessThan

	before = table.current_snapshot()
	rows = table.scan(row_filter=LessThan("__ingest_ts", cutoff)).to_arrow()
	values = rows.column("value").to_pylist()
	found: Counter[str] = Counter()
	changed = 0
	scrubbed = []
	for value in values:
		new, removed, did_change = scrub_value(value)
		scrubbed.append(new)
		found.update(removed)
		changed += did_change
	print(f"{TABLE}: {len(values)} rows, {changed} to scrub")
	for rule, count in found.most_common():
		print(f"  {rule}: {count}")
	if not apply or changed == 0:
		return
	index = rows.schema.get_field_index("value")
	rows = rows.set_column(
		index, rows.schema.field(index), pa.array(scrubbed, rows.column("value").type)
	)
	table.overwrite(rows, overwrite_filter=LessThan("__ingest_ts", cutoff))
	print(f"{TABLE}: committed; previous snapshot {before.snapshot_id if before else 'none'}")
	print("The previous snapshot still holds the personal data until snapshot expiry (7 days).")


def rollback(snapshot_id: int) -> None:
	table = catalog().load_table((NAMESPACE, TABLE))
	table.manage_snapshots().set_current_snapshot(snapshot_id=snapshot_id).commit()
	print(f"{TABLE}: current snapshot set to {snapshot_id}")


def main(argv: list[str]) -> None:
	if argv[:1] == ["--rollback"]:
		if len(argv) != 2:
			sys.exit("Usage: --rollback <snapshot-id>")
		rollback(int(argv[1]))
		return
	apply = "--apply" in argv
	# __ingest_ts is a timestamp without zone, in UTC.
	cutoff = datetime.now(timezone.utc).replace(tzinfo=None).isoformat(timespec="microseconds")
	print(f"{'Applying' if apply else 'Dry run'}: rows ingested before {cutoff} UTC")
	scrub_archive(catalog().load_table((NAMESPACE, TABLE)), cutoff, apply)
	if not apply:
		print("Nothing written. Re-run with --apply to commit.")


if __name__ == "__main__":
	# SCRUB_ARGS lets a task runner that doesn't forward arguments pass them.
	main(sys.argv[1:] or os.environ.get("SCRUB_ARGS", "").split())
