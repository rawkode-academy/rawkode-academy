# PoC cost estimate

Prices checked **31 October 2026**, USD per month, before tax. These are reproducible workload estimates at public list prices, not measured Rawkode Academy usage or a spending cap. Enterprise contracts may differ.

For a small, single-channel deployment, the expected starting point is the **$5/month Workers Paid account minimum**, with little or no additional usage charge while the account's included allocations remain available. An account already on Workers Paid does not pay another $5 for this Worker.

The expensive failure mode is repeatedly scanning a growing, poorly organized warehouse. At **100 GB/month** of fresh report payloads, the modeled efficient case is **$10.91 incremental/month**. The deliberately bounded worst case reaches **$39,302.62/month**, primarily from 3,000 full-history queries and many small objects. The ingestion/storage/application portion of those cases, with user SQL queries removed, is **$10.71 / $2,301.52**. The large difference is intentional: cheap ingestion does not imply cheap unbounded querying.

## What this implementation bills

1. YouTube collection writes source report pages to private R2 and persists a small outbox entry.
2. K2 carries a **snapshot pointer**, not the complete report. The present pointer payload is 332 bytes; this model budgets 512 bytes including event metadata.
3. The consumer reads the R2 archive and sends the complete normalized report to Basin Pipelines. Pipelines performs the transform and Iceberg sink write.
4. Basin SQL reads compressed Iceberg data for stored analytics queries. Selecting a single result with `LIMIT 1` does not establish how many files or bytes the engine will scan.
5. Durable Object SQLite holds publishing state and the delivery outbox. It does not hold the analytical history. OAuth uses KV.

Default collection refreshes four canonical 28-day reports once daily: approximately 120 fresh snapshots per 30-day month. Stored queries do not automatically refetch Google because of age; an explicit refresh or missing query produces a fresh snapshot. As an **illustration**, 120 snapshots at 32 KB each is 3.84 MB/month of normalized payload. Neither that size nor actual scan selectivity has been measured on the channel yet.

Re-fetching a 28-day window every day counts each returned byte again. Replaying an existing snapshot also incurs transport, Pipeline and storage work even though deterministic snapshot selection prevents double counting in the answer. Do not estimate cost from unique video count or net new rows alone.

## Monthly estimates at several ingestion scales

`G` is fresh, uncompressed, JSON-serialized **Basin record payload GB/month**, including its metadata, before delivery retries. It already includes repeated overlapping report windows. Both scenarios use the same `G`; their record sizes, retry rate, retention, compaction and queries differ as stated below.

The table models the **average holdings in month 12** after constant ingestion, using 11.5 months of accumulated analytical data. It uses today's prices, not a promise that those prices last twelve months. Current K2 beta charges are zero. Included allocations are available to this workload once per account, not once per bucket or table.

| Fresh payload/month | Ingestion, storage and app, best | Ingestion, storage and app, worst | With queries, best | With queries, worst |
| ---: | ---: | ---: | ---: | ---: |
| 0.01 GB / 10 MB | $0.00 | $0.00 | $0.00 | $3.21 |
| 1 GB | $0.00 | $10.18 | $0.00 | $377.20 |
| 10 GB | $0.42 | $201.89 | $0.42 | $3,902.14 |
| 100 GB | $10.71 | $2,301.52 | $10.91 | $39,302.62 |
| 1,000 GB / 1 TB | $186.53 | $23,700.43 | $188.77 | $393,713.32 |

These are **incremental usage charges**. Add $5 if a new Workers Paid subscription is needed. The first two columns are computed with zero user analytics queries; they still include collection, scheduled draining, compaction, R2 reads/writes and application requests. Automatic invocation logs are disabled in this deployment; exceptional/custom log volume is an optional sensitivity below. The worst-case column is a defined stress workload, not an absolute maximum. More queries, longer retention, additional consumers or more retries can exceed it.

High-volume rows are **capacity-planning projections**, not throughput guarantees for the PoC. One scheduled drain processes at most ten records every five minutes: 86,400 pointers per 30 days, plus daily/manual drains. At 128 KB per report and no retries, that is about 11.06 GB/month; at 8 KB and three deliveries per fresh report, about 0.23 GB/month. Scale consumer batch size, scheduling and coordination before attempting higher loads. YouTube API quotas are another independent constraint.

## Best and worst workload assumptions

| Assumption | Best: efficient and bounded | Worst: small files and full scans |
| --- | --- | --- |
| Mean complete Basin record | 128 KB | 8 KB |
| Accepted K2 copies per fresh snapshot | 1 | 2 |
| Total K2 reads and Pipeline deliveries per fresh snapshot | 1 | 3, including redelivery |
| Raw archive bytes / fresh Basin payload | 0.75 | 1.0 |
| Raw archive retention | 30 days, requires a lifecycle policy | No expiry during the 12-month model |
| Analytical rows retained | All appended snapshots, 11.5 months on average | Same, including delivered duplicates |
| Stored compressed bytes / delivered payload | 0.25 | 1.0 |
| Metadata and obsolete-file storage allowance | 5% above compressed data | 25% above compressed data |
| Initial data files | At least 30/month, otherwise 64 MB target | One file for each report delivery |
| Files after compaction | 64 MB target | 1 MB target |
| Compaction passes over new compressed data | 1 read + rewrite | 4 reads + rewrites |
| User Basin queries | 300/month | 3,000/month |
| Data touched per query | 0.1% of retained compressed holdings | 100% of retained compressed holdings |
| Minimum charged scan | 10 MB/query | 10 MB/query |
| K2 retention | 7 days | 30 days |
| Worker CPU assumption | 3 ms/invocation | 30 ms/invocation |
| Automatic invocation logs | Disabled; 0/invocation | Disabled; 0/invocation |
| SQLite writes per fresh snapshot, including outbox work | 4 | 10 |

**The best-case pruning, compression, file sizes and raw expiry are assumptions to validate or configure, not optimizations already guaranteed by this PR.** The current table stores whole-report JSON and has no demonstrated `query_key` clustering. Measure real scans before increasing usage. The setup does not implement analytical row deletion; Iceberg snapshot expiration removes obsolete table snapshots/files, not rows still referenced by the current table. History therefore keeps growing beyond this horizon unless a separate retention/rewrite process is added.

The operation model uses one R2 PUT per fresh archive, one GET per Pipeline delivery, two R2 metadata writes and four Catalog operations per file commit, and two metadata reads per SQL query. Compaction includes reading its input objects and writing replacement files. These are deliberately visible planning coefficients, not Cloudflare guarantees about internal request counts. Replace them with measured billing counters after the first run.

Application estimates use one invocation per fresh report, one per query, enough ten-record drains to carry the modeled volume (at least 8,640/month), and 1,000 other publishing/authentication invocations. This conservatively counts individual reports even when a collection call fetches four reports. The outbox is assumed to drain, with metadata under 5 GB and OAuth KV under its allowances. One channel Durable Object active continuously for 30 days is at most 331,776 GB-seconds, below the 400,000 included allocation. Additional channel objects need a separate duration estimate. Only sanitized exceptional application logs remain enabled; the main table assumes they stay within the account allowance. Persistent backlog, arbitrary client traffic and high exceptional/custom log volume are outside these bounds.

## Why the 100 GB stress case is expensive

| Monthly charge | Best | Worst |
| --- | ---: | ---: |
| Pipeline transform + Iceberg sink | $5.00 | $25.00 |
| R2 storage | $5.51 | $81.80 |
| R2 writes | $0.00 | $576.00 |
| R2 reads, including SQL scans | $0.00 | $4,709.16 |
| Catalog metadata operations | $0.00 | $1,384.25 |
| Catalog compaction, bytes + objects | $0.20 | $86.75 |
| Basin SQL scans | $0.20 | $32,343.73 |
| Workers and Durable Object usage | $0.00 | $95.94 |
| Current K2 beta | $0.00 | $0.00 |
| **Incremental total** | **$10.91** | **$39,302.62** |

Totals use unrounded intermediate values; rounded component rows may differ by a cent. The stress case retains about 4,312.5 GB of compressed Iceberg holdings in month 12. Scanning that 3,000 times produces approximately **12.94 PB of billed scans**. SQL filtering and duplicate-safe results do not themselves reduce those storage reads. A query budget, appropriate file organization and compaction matter much more here than K2 transport price.

## Current rates and announced changes

All sizes in the calculator use decimal GB (`1 GB = 1,000,000,000 bytes`); KB and MB are decimal too. Code payload limits expressed in KiB/MiB must be converted. Rates and allowances below are account-level public list prices.

| Meter | Monthly included usage | Additional rate used |
| --- | ---: | ---: |
| Workers Paid account | Shared platform allowances | $5 minimum/account |
| Worker requests / CPU | 10 million / 30 million ms | $0.30/million / $0.02/million ms |
| Workers Logs, through 30 November 2026 | 20 million events | $0.60/million events |
| R2 Standard storage | 10 GB-month | $0.015/GB-month |
| R2 Class A / Class B | 1 million / 10 million | $4.50/million / $0.36/million |
| Pipeline transforms | 50 GB | $0.04/GB processed |
| Pipeline Iceberg sink | 50 GB | $0.06/GB **uncompressed** delivered |
| Basin SQL | 10 GB scanned | $0.0025/GB **compressed** scanned; 10 MB/query minimum |
| Catalog operations | 1 million | $9/million |
| Catalog compaction bytes / objects | 10 GB / 1 million | $0.005/GB processed / $2/million objects |
| DO requests / duration | 1 million / 400,000 GB-s | $0.15/million / $12.50/million GB-s |
| DO SQLite reads / writes / storage | 25 billion / 50 million / 5 GB-month | $0.001/million / $1/million / $0.20/GB-month |
| OAuth KV reads / writes / storage | 10 million / 1 million / 1 GB-month | $0.50/million / $5/million / $0.50/GB-month |

Pipeline ingress and R2 egress are free; this does not remove sink, storage, request or query charges. R2 rounds billable storage up to whole GB-month and operation usage up to million-request units. The calculator also rounds DO compute meters as documented. It applies allocations once across the modeled service. If other Academy services have used them, incremental charges will be higher. For the data services alone, losing all included allocations removes up to approximately $24.33/month of modeled benefit, before application-platform allowances.

**K2 is still unbilled during public beta.** Its announced, not-yet-effective prices are $0.04/GB produced, $0.04/GB consumed and $0.02/GB-month retained. Because this design transports pointers, the future additions are small under these assumptions:

| Fresh report payload/month | Proposed K2 addition, best | Proposed K2 addition, worst |
| ---: | ---: | ---: |
| 1 GB | $0.0003 | $0.0154 |
| 10 GB | $0.0034 | $0.1536 |
| 100 GB | $0.0339 | $1.5360 |
| 1,000 GB | $0.3387 | $15.3600 |

The worst case retains 12.8 GB of pointers at 100 GB fresh report payload/month, and 128 GB at 1 TB. Both exceed K2's current 10 GB/account beta storage limit and require a higher limit or shorter retention. Price projections do not grant that capacity.

**Observability pricing changes on 1 December 2026.** Paid plans will include 50 GB ingestion and 10 GB-month storage, with $0.25/GB additional ingestion and $0.10/GB-month additional storage. The main model has **no log overage and no December adjustment**, because automatic invocation logging is disabled and exceptional logs are assumed to fit the allowance.

For an optional high-volume logging sensitivity, pass `--logs-per-invocation 3`. This budgets three **exceptional/custom** events per modeled invocation; it does not describe current app emissions. The calculator uses seven-day retention and Cloudflare's published 4.84 KB average Workers event size, not a measurement of this app. In the worst workload, that sensitivity adds **$17.26/month at 100 GB** or **$280.51/month at 1 TB** under current log pricing. December's replacement log charges would be **$51.01 / $631.45**, respectively, an increase of **$33.75 / $350.94** over the optional current-log charges. Do not add both old and replacement charges. K2's eventual billing start and other future prices remain unknown.

## Reproduce and replace assumptions

From this directory, after the repository-required `cuenv sync -A`:

```sh
python3 scripts/cost_estimate.py
python3 scripts/cost_estimate.py --queries 0
python3 scripts/cost_estimate.py --gb 1 10 100 1000 --json
python3 scripts/cost_estimate.py --gb 100 --scenario worst --queries 300
python3 scripts/cost_estimate.py --gb 100 --scenario worst --logs-per-invocation 3 --json
python3 -m unittest discover -s test -p '*_test.py'
```

The JSON output includes every usage coefficient, charge and proposed pricing adjustment. Seven arithmetic checks cover published pricing examples, unit rounding, the minimum query scan, pointer-based K2 volume, replay amplification and disabled automatic logging. `cuenv` was unavailable in the build environment; the standalone Python checks passed.

Before increasing scale, record actual serialized Pipeline bytes, source archive bytes, compressed table size, files per commit, query bytes scanned, R2/Catalog operations, Worker CPU and retained log bytes. In particular, run the same query on a populated table and verify its scan volume rather than inferring it from one returned row. Set an initial query/usage budget and alerts in the account; alerts are not a hard billing cap. No budget alert or automatic retention policy is created by this estimate.

## Sources

Official documentation retrieved 31 October 2026:

- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), including the $5 account minimum and request/CPU rates.
- [Workers Logs pricing](https://developers.cloudflare.com/workers/observability/logs/workers-logs/), current event-based prices.
- [Observability pricing](https://developers.cloudflare.com/observability/pricing/) and [dataset sizes](https://developers.cloudflare.com/observability/logs/datasets/), announced 1 December change and average event size.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/), last updated 30 October, including allowances and billable-unit rounding.
- [Basin Pipelines pricing](https://developers.cloudflare.com/basin-pipelines/platform/pricing/), uncompressed transform/sink meters.
- [Basin SQL pricing](https://developers.cloudflare.com/basin-sql/platform/pricing/), compressed scans and per-query minimum.
- [Basin Catalog pricing](https://developers.cloudflare.com/basin-catalog/platform/pricing/), metadata operations, compaction and snapshot expiration.
- [K2 pricing](https://developers.cloudflare.com/k2/platform/pricing/) and [limits](https://developers.cloudflare.com/k2/platform/limits/), free beta, proposed rates and capacity.
- [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [KV pricing](https://developers.cloudflare.com/kv/platform/pricing/).
