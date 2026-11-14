#!/usr/bin/env python3
"""Reproduce COSTS.md using public list prices checked 2026-10-31.

Planning assumptions, not measured channel usage or a Cloudflare quote.
GB = 1_000_000_000 bytes. K2 proposed pricing is excluded from current totals.
"""
from __future__ import annotations

import argparse
import json
import math
from dataclasses import asdict, dataclass, replace

GB = 1_000_000_000
MILLION = 1_000_000


@dataclass(frozen=True)
class Scenario:
    snapshot_bytes: int
    accepted_k2_copies: float
    pipeline_deliveries: float
    compression: float
    raw_to_pipeline_ratio: float
    raw_retention_months: float
    file_overhead: float
    final_file_bytes: int
    file_per_delivery: bool
    compaction_passes: int
    queries: int
    scan_fraction: float
    cpu_ms: float
    sql_writes_per_snapshot: int
    k2_retention_days: int
    logs_per_invocation: int


SCENARIOS = {
    "best": Scenario(128_000, 1, 1, 0.25, 0.75, 1, 1.05, 64_000_000, False, 1, 300, 0.001, 3, 4, 7, 0),
    "worst": Scenario(8_000, 2, 3, 1, 1, 12, 1.25, 1_000_000, True, 4, 3000, 1, 30, 10, 30, 0),
}


def over(usage: float, included: float) -> float:
    return max(usage - included, 0)


def rounded_charge(usage: float, included: float, unit: float, price: float) -> float:
    """R2 and DO compute round excess usage up to their billing units."""
    return math.ceil(over(usage, included) / unit) * price


def pipeline_cost(transformed_gb: float, delivered_gb: float) -> float:
    return over(transformed_gb, 50) * 0.04 + over(delivered_gb, 50) * 0.06


def estimate(fresh_gb: float, scenario: str, *, query_count: int | None = None, logs_per_invocation: int | None = None) -> dict:
    if not math.isfinite(fresh_gb) or fresh_gb <= 0:
        raise ValueError("fresh_gb must be a positive finite number")
    s = SCENARIOS[scenario]
    if query_count is not None:
        if query_count < 0:
            raise ValueError("query_count must be nonnegative")
        s = replace(s, queries=query_count)
    if logs_per_invocation is not None:
        if logs_per_invocation < 0:
            raise ValueError("logs_per_invocation must be nonnegative")
        s = replace(s, logs_per_invocation=logs_per_invocation)
    # Average holdings in month 12 at a constant ingestion rate; no table-row TTL.
    history_months = 11.5
    snapshots = math.ceil(fresh_gb * GB / s.snapshot_bytes)
    delivered_gb = fresh_gb * s.pipeline_deliveries
    compressed_gb = delivered_gb * s.compression
    raw_storage = fresh_gb * s.raw_to_pipeline_ratio * min(s.raw_retention_months, history_months)
    iceberg_storage = compressed_gb * history_months * s.file_overhead
    storage = raw_storage + iceberg_storage + 0.02  # 100 illustrative 200KB thumbnails.
    ingress_files = (math.ceil(snapshots * s.pipeline_deliveries) if s.file_per_delivery
                     else max(30, math.ceil(compressed_gb * GB / s.final_file_bytes)))
    final_month_files = max(1, math.ceil(compressed_gb * GB / s.final_file_bytes))
    compacted_objects = ingress_files + (s.compaction_passes - 1) * final_month_files
    rewritten_files = s.compaction_passes * final_month_files
    commits = ingress_files + rewritten_files
    compaction_gb = compressed_gb * 2 * s.compaction_passes  # read + rewrite.
    scan_per_query = max(0.01, iceberg_storage * s.scan_fraction)  # 10MB minimum.
    scanned_gb = s.queries * scan_per_query
    query_objects = s.queries * (max(1, math.ceil(iceberg_storage * s.scan_fraction * GB / s.final_file_bytes)) + 2)
    class_a = snapshots + 3 * commits + 100  # Data writes + 2 metadata writes/commit.
    class_b_background = snapshots * s.pipeline_deliveries + compacted_objects + 2 * commits
    class_b = class_b_background + query_objects
    catalog_ops_background = 4 * commits
    catalog_ops = catalog_ops_background + 2 * s.queries
    drains = max(8640, math.ceil(snapshots * s.pipeline_deliveries / 10))
    invocations = snapshots + s.queries + drains + 1000
    rows_written = snapshots * s.sql_writes_per_snapshot + 2 * drains + 10_000
    rows_read = snapshots * 100 + 2 * drains
    pointer_gb = snapshots * 512 / GB  # Actual current payload is 332B, plus headers allowance.
    produced_gb = pointer_gb * s.accepted_k2_copies
    consumed_gb = pointer_gb * s.pipeline_deliveries
    retained_gb = produced_gb * s.k2_retention_days / 30
    # Automatic invocation logs are disabled. Main scenarios budget no log
    # overage; callers can model exceptional/custom events as a sensitivity.
    logs = invocations * s.logs_per_invocation
    # Published Workers dataset average, not a measurement of this service.
    log_gb = logs * 4840 / GB
    december_logs = over(log_gb, 50) * 0.25 + over(log_gb * 7 / 30, 10) * 0.10
    charges = {
        "pipelines_transform": over(delivered_gb, 50) * 0.04,
        "pipelines_iceberg_sink": over(delivered_gb, 50) * 0.06,
        "r2_storage": rounded_charge(storage, 10, 1, 0.015),
        "r2_class_a": rounded_charge(class_a, MILLION, MILLION, 4.50),
        "r2_class_b": rounded_charge(class_b, 10 * MILLION, MILLION, 0.36),
        "catalog_operations": over(catalog_ops, MILLION) / MILLION * 9,
        "catalog_compaction_bytes": over(compaction_gb, 10) * 0.005,
        "catalog_compaction_objects": over(compacted_objects, MILLION) / MILLION * 2,
        "basin_sql": over(scanned_gb, 10) * 0.0025,
        "worker_requests": over(invocations, 10 * MILLION) / MILLION * 0.30,
        "worker_cpu": over(invocations * s.cpu_ms, 30 * MILLION) / MILLION * 0.02,
        "workers_logs_current": over(logs, 20 * MILLION) / MILLION * 0.60,
        "do_requests": rounded_charge(invocations, MILLION, MILLION, 0.15),
        "do_sql_writes": over(rows_written, 50 * MILLION) / MILLION,
        "do_sql_reads": over(rows_read, 25_000 * MILLION) / MILLION * 0.001,
        # One channel DO always active for 30 days uses at most 331,776 GB-s,
        # below 400,000 included. Bounded outbox + OAuth KV fit storage allowances.
        "do_duration_and_storage": 0,
        "oauth_kv": 0,
        "k2_beta": 0,
    }
    total = sum(charges.values())
    proposed_k2 = produced_gb * 0.04 + consumed_gb * 0.04 + retained_gb * 0.02
    query_cost = (charges["basin_sql"]
                  + charges["r2_class_b"] - rounded_charge(class_b_background, 10 * MILLION, MILLION, 0.36)
                  + charges["catalog_operations"] - over(catalog_ops_background, MILLION) / MILLION * 9)
    return {
        "scenario": scenario, "fresh_gb": fresh_gb, "assumptions": asdict(s),
        "usage": {"snapshots": snapshots, "pipeline_gb": delivered_gb, "raw_storage_gb_month": raw_storage,
                  "iceberg_storage_gb_month": iceberg_storage, "r2_storage_gb_month": storage,
                  "r2_class_a": class_a, "r2_class_b": class_b, "catalog_operations": catalog_ops,
                  "compaction_gb": compaction_gb, "compacted_objects": compacted_objects,
                  "sql_scanned_gb": scanned_gb, "worker_invocations": invocations,
                  "do_rows_written": rows_written, "k2_produced_gb": produced_gb,
                  "k2_consumed_gb": consumed_gb, "k2_retained_gb": retained_gb,
                  "log_events": logs, "estimated_log_gb": log_gb},
        "charges": charges, "query_related_usd": query_cost,
        "incremental_usd": total, "new_paid_account_usd": total + 5,
        "proposed_k2_addition_usd": proposed_k2,
        "december_observability_usd": december_logs,
        "december_observability_change_usd": december_logs - charges["workers_logs_current"],
        "exceeds_current_k2_beta_storage": retained_gb > 10,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--gb", type=float, nargs="+", default=[0.01, 1, 10, 100, 1000])
    parser.add_argument("--scenario", choices=list(SCENARIOS))
    parser.add_argument("--queries", type=int)
    parser.add_argument("--logs-per-invocation", type=int, help="Optional exceptional/custom logging sensitivity; default 0 because automatic invocation logs are disabled")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    results = [estimate(gb, scenario, query_count=args.queries, logs_per_invocation=args.logs_per_invocation) for gb in args.gb for scenario in ([args.scenario] if args.scenario else SCENARIOS)]
    if args.json:
        print(json.dumps(results, indent=2))
    else:
        print("| Fresh GB/month | Scenario | Current incremental/month | Including new $5 plan | Proposed K2 addition |")
        print("| ---: | --- | ---: | ---: | ---: |")
        for r in results:
            print(f"| {r['fresh_gb']:g} | {r['scenario']} | ${r['incremental_usd']:,.2f} | ${r['new_paid_account_usd']:,.2f} | +${r['proposed_k2_addition_usd']:,.4f} |")


if __name__ == "__main__":
    main()
