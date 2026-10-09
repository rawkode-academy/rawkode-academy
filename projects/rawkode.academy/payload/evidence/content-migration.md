# Static and Klustered content migration

This migration is intentionally additive. Payload becomes the editable catalogue for the Astro static collections and the not-yet-launched Klustered competition domain. It does not take ownership of Academy identity, notifications, preferences, reactions, watch history, or other live platform workers.

## Ownership boundary

| Source | Payload collections | Default treatment |
| --- | --- | --- |
| `content/` Astro collections | `videos`, `shows`, `people`, `articles`, `technologies`, `series`, `adrs`, `testimonials`, `courses`, `course-modules`, `changelog`, `learning-paths`, `news`, `chapters`, `learning-resources`, `static-assets` | Import all source records and preserve Markdown/MDX/YAML, frontmatter, local assets, source paths and checksums. |
| `platform-brackets` D1 | `seasons`, `competitors`, `brackets`, `bracket-applications`, `teams`, `team-members`, `bracket-breaks`, `bracket-entries`, `matches`, `match-results` | Import the pre-launch Klustered domain by stable source IDs. |
| `platform-brackets` D1 sensitive records | `team-invites`, `registrations` | Excluded unless `--include-sensitive` is explicitly supplied. These records contain invite tokens and registration PII. |
| Existing Academy workers | Identity, preferences, reactions, watch history, notifications and other platform data | Remain authoritative outside Payload until a separate parity and cutover gate passes. |

The Payload schema keeps the existing legacy ID, legacy type and slug fields. Source-native values are stored in editable fields where they have a stable editorial meaning, and the complete source object/body is retained in provenance fields for reconciliation. Payload's own `createdAt` and `updatedAt` remain system timestamps; source frontmatter timestamps remain in `sourceData`. Klustered source identifiers use explicit `source*` fields while Payload relationship IDs remain separate, so editors can change a relationship without losing the source key.

## Export and import

Run these commands from `projects/rawkode.academy/payload` with the Cloudflare credentials supplied by cuenv or the CI environment:

```sh
# Read the current Klustered D1 source into a reproducible snapshot.
bun run export:klustered -- --remote .runtime/klustered.json

# Build and validate the Astro content snapshot, including local assets.
bun run import:static -- --dry-run
bun run import:static

# Validate and then apply the non-sensitive Klustered domain after static
# content has established the `shows:klustered` relationship target.
bun run import:klustered -- --dry-run .runtime/klustered.json
bun run import:klustered -- .runtime/klustered.json
```

### Import targets

`import:static`, `import:klustered`, `reconcile:static` and `migrate:status` take `--target=local|rehearsal|production`. The default is `local` (the Miniflare state under `.wrangler/state`). `--remote` (and any `--remote=<value>`) is rejected with a non-zero exit, because it used to resolve local or preview bindings, never production. `preview` is never an import target: the preview D1 holds live review data and has no reset path.

`scripts/lib/remote-target.ts` writes `.runtime/wrangler.<target>-cli.json` with only `D1` and `R2`, both `remote: true`, and no `previews` block, then asserts the resolved IDs before the platform proxy is created:

| Target | D1 | R2 | Source of the IDs |
| --- | --- | --- | --- |
| `local` | Miniflare | Miniflare | `wrangler.jsonc`, local bindings |
| `rehearsal` | `rawkode-academy-payload-rehearsal` (disposable) | disposable bucket | `REHEARSAL_D1_ID` (lowercase hyphenated UUID), `REHEARSAL_R2_BUCKET`, optional `REHEARSAL_D1_NAME`. Both names must contain `rehearsal`. Preview and production IDs (in any spelling) and the `rawkode-academy-content` CDN bucket are refused |
| `production` | `rawkode-academy-payload` (`8e77ba09-dc5a-4760-99da-c7b27bf0a059`) | `rawkode-academy-payload` | `wrangler.jsonc` top-level bindings, checked against constants |

`migrate-production.ts` and `migrate-preview.ts` use the same module, so the migration commands get the same assertion. `migrate-production.ts` migrates production by default and takes `--target=rehearsal` (`bun run migrate:rehearsal`) to give a fresh rehearsal D1 its schema.

A production import refuses to start unless all of these hold:

- `CONFIRM_PRODUCTION_IMPORT=rawkode-academy-payload` (or `--confirm-production=rawkode-academy-payload`) is set. Klustered uses its own token, `CONFIRM_PRODUCTION_KLUSTERED_IMPORT=rawkode-academy-payload-klustered` (or `--confirm-production-klustered=...`), so confirming the static window never confirms a Klustered production import.
- The git tree is clean, and `STATIC_CONTENT_ROOT` does not override `content/`.
- `STATIC_CONTENT_SEQUENCE` records the watermark explicitly, and it is not lower than max(commit time of `content/`, commit time of `src/static-content.ts`). For Klustered, `KLUSTERED_CONTENT_SEQUENCE` or the export `__meta.sequence` is the watermark.
- The sequence is higher than the highest `sourceSequence` already stored for the source system. Re-running the same sequence needs `--resume` and only finishes an interrupted run.
- `--include-sensitive` is absent. Klustered sensitive tables are never imported into production.

Rehearsal applies the same stored-watermark check. Each run writes its result, target resources and watermark (git SHA and sequence) to `.runtime/import-<target>-<sha>.json`. Asset uploads skip objects whose R2 `head()` already shows the same size and checksum.

### Operator tasks

These cuenv tasks are not part of any CI pipeline. Production tasks need the production environment for the Cloudflare token (`cuenv task -e production <task>`):

| Task | Command |
| --- | --- |
| `migrate.status` | Check-only list of registered migrations missing from production. Exits 1 when any are missing. |
| `migrate.rehearsal` | Apply migrations to the disposable rehearsal D1. `import.rehearsal` depends on it. |
| `import.rehearsal` / `reconcile.rehearsal` | Import into and reconcile the disposable rehearsal D1/R2. |
| `import.productionDryRun` / `import.production` | Production dry-run and run. Both depend on `migrate.status`, not `deploy.migrate`, because `deploy.migrate` can write Worker secrets. |
| `import.klusteredRehearsal` | Klustered import into the rehearsal D1 from `KLUSTERED_SNAPSHOT_PATH`. There is no production Klustered task: the first production window imports static content only. |
| `reconcile.production` | Production reconciliation report. Needs the same `STATIC_CONTENT_SEQUENCE` the production import recorded. |

The static importer uploads content assets to R2 using checksum-addressed keys. It includes the Astro static resource files (including example code/data) and derives the existing content video and episode URLs from the same stable IDs used by the site. Imports are serialized and resumable at record level, but are not one transaction across the graph. Run a source export and dry-run first, use an exclusive import window, and retain the source watermark and command output.

Snapshots carry an explicit source sequence. Set `STATIC_CONTENT_SEQUENCE` or `KLUSTERED_CONTENT_SEQUENCE` to the source watermark when producing a repeatable export; the default is `1`, which makes repeated dry-runs deterministic but intentionally rejects a changed source at the same sequence. A changed source must be imported with a higher sequence.

The Klustered exporter orders rows by stable keys and writes null-valued columns into the snapshot. It excludes `team_invites` and `registrations` by default; `--include-sensitive` opts them in, and the importer redacts their invite tokens from action/conflict output.

`--include-sensitive` is an explicit operator decision:

```sh
bun run import:klustered -- --include-sensitive .runtime/klustered.json
```

Do not put snapshots containing invite tokens or registration email addresses in a pull request, build artifact, or public bucket.

## Reconciliation and rollback

Before accepting an import, run `reconcile:static` against the same target and watermark. It is read-only. It rebuilds the snapshot from `content/` and compares it with the target:

- record counts per collection
- missing, extra and duplicate `legacyId`s
- slugs, `sourceRevision` (file checksum) and the recomputed `sourceHash`
- `sourceSequence`, `importState`, `locallyEdited`, `tombstone` and `_status`
- ordered relationship edges, rewritten to legacy IDs because numeric IDs differ between environments
- R2 static asset size and checksum, and `static/` objects that no record references

The compared sequence comes from `STATIC_CONTENT_SEQUENCE`. For `local` and `rehearsal` it falls back to the git commit-time watermark, as the import does. For `production` it is required, because the production import refuses a derived watermark. The report names the source it used.

Orphaned `static/` objects (no record references them) are diffs and fail the report. Asset keys are content-addressed and imports never delete, so a later re-import after a changed, renamed or removed asset leaves the previous object behind. Only in that case, after reviewing the listed keys, pass `--allow-orphans` to list them without failing. The first import into an empty rehearsal or production bucket must reconcile without it.

It writes `<target>-<sha>.json` and `<target>-<sha>.md` to `evidence/reconciliation/` (to `.runtime/reconciliation/` for `local`, or `--out=<dir>`) and exits 1 on any diff. Resolve conflicts where an editor changed a Payload record; the importer will not silently overwrite `locallyEdited` content.

Rollback is routing-level: stop Payload imports and writes, retain the source workers, and point readers back to the existing Astro/API authority. Reconcile any accepted Payload edits from the recorded watermark before retrying. Dropping the Payload database alone is not a rollback plan because it loses those edits.

The public Academy gateway is not replaced by this migration. Its captured GraphQL contract remains separately tested, while Payload's generated `/api/graphql` supports staff CRUD and mutations. A production route, DNS cutover, or production data import requires a separate reviewed deployment gate.
