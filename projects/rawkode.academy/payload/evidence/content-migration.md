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

The static importer uploads content assets to R2 using checksum-addressed keys. It includes the Astro static resource files (including example code/data) and derives the existing content video and episode URLs from the same stable IDs used by the site. Imports are serialized and resumable at record level, but are not one transaction across the graph. Run a source export and dry-run first, use an exclusive import window, and retain the source watermark and command output.

Snapshots carry an explicit source sequence. Set `STATIC_CONTENT_SEQUENCE` or `KLUSTERED_CONTENT_SEQUENCE` to the source watermark when producing a repeatable export; the default is `1`, which makes repeated dry-runs deterministic but intentionally rejects a changed source at the same sequence. A changed source must be imported with a higher sequence.

The Klustered exporter orders rows by stable keys and writes null-valued columns into the snapshot. It excludes `team_invites` and `registrations` by default; `--include-sensitive` opts them in, and the importer redacts their invite tokens from action/conflict output.

`--include-sensitive` is an explicit operator decision:

```sh
bun run import:klustered -- --include-sensitive .runtime/klustered.json
```

Do not put snapshots containing invite tokens or registration email addresses in a pull request, build artifact, or public bucket.

## Reconciliation and rollback

Before accepting an import, compare source and Payload counts by collection, then compare every `legacyId`, slug, source checksum, relationship edge and asset checksum. Resolve conflicts where an editor changed a Payload record; the importer will not silently overwrite `locallyEdited` content.

Rollback is routing-level: stop Payload imports and writes, retain the source workers, and point readers back to the existing Astro/API authority. Reconcile any accepted Payload edits from the recorded watermark before retrying. Dropping the Payload database alone is not a rollback plan because it loses those edits.

The public Academy gateway is not replaced by this migration. Its captured GraphQL contract remains separately tested, while Payload's generated `/api/graphql` supports staff CRUD and mutations. A production route, DNS cutover, or production data import requires a separate reviewed deployment gate.
