# Static content migration

Payload owns the site's editable static content. Astro SSR obtains published
documents through the internal `PublicContentBridge` service binding. No public
Payload GraphQL or arbitrary REST read API is part of this path.

## Imported data

The static importer reads the repository `content/` tree, writes document
records to D1, and uploads referenced assets to R2. It preserves every website
slug and each video's existing R2 content ID as the Payload video `id`. All
other Payload document IDs use the canonical CUID2 generator.

For repeatable imports, imported nonvideo documents keep an optional hidden
`legacyId` source key. Editor-created records do not receive one. Videos use
their primary ID as source identity. Source path and asset references remain
for relative media resolution; source hashes, revisions, sequence and import
state support reconciliation. Duplicate copies of raw frontmatter and body
content were removed.

`static-assets` has no draft status. The public bridge treats it as visible
only when the asset is not tombstoned and its storage metadata is valid. Video
publication is separately controlled by `_status` and `publishedAt`; a future
date on a published video is the schedule. Public cache freshness is clipped
to the earliest upcoming publication boundary.

## Database and production cutover

The historical `src/migrations/` chain is preserved byte-for-byte for the
existing integer-ID shared Preview database. Fresh local, rehearsal and PR
preview databases use the copied `src/migrations-cuid2/` chain, with
`cuid2_...` migration names. Its final cleanup migration removes obsolete
duplicate source columns, removes videos' duplicate `legacy_id`, and rebuilds
`static-assets` and its version table so import keys are nullable. The final
snapshot reflects that fresh schema. Cleanup drops duplicate payload data and
is not reversible; use the preserved database for rollback.

The current production D1 still uses integer document IDs. Production selects
the CUID2 chain, but the migration target guard rejects the current D1 before
any migration write. PR preview uses isolated D1/R2 resources created from the
fresh CUID2-compatible chain. Production needs a separate reviewed export,
reimport, relationship-reference verification, and binding cutover. Keep the
old D1 as the rollback target until editorial, authentication, review, media,
publication schedule, slug and asset checks pass on the reimported database.
