# Rawkode Academy CMS

Payload is the editorial source for the site's static content. Astro renders
pages with SSR and reads public content from the internal `PublicContentBridge`
service binding. The bridge exposes fixed public projections, enforces publish,
tombstone and schedule visibility, and returns bounded cache lifetimes. Payload
REST is used by the admin and staff tools. The generated GraphQL API and the old
compatibility GraphQL facade are disabled and removed.

## Content and IDs

The static importer reads the repository `content/` tree and writes document
records plus local assets to D1 and R2. Website slugs remain unchanged. Video
Payload IDs retain the existing R2 content IDs byte-for-byte; other Payload
document IDs use the canonical CUID2 generator. `legacyId` is an optional,
hidden import key for imported nonvideo records only. It is not generated for
editor-created records and will be retired after importer cutover.

The importer keeps only source metadata needed for repeatable imports and asset
resolution: `sourcePath`, `sourceAssets`, source hashes/revisions, import state,
sequence and reconciliation fields. It does not copy the complete frontmatter
or body into duplicate fields. Local assets use checksum-addressed R2 keys.
D2 source is rendered into checksum-addressed SVG artifacts before publication.

Publishing a video with a future `publishedAt` schedules its public visibility
automatically. The bridge excludes the video until that time and clips cache
lifetimes to the next publication boundary. Publishing, unpublishing or a
tombstone therefore takes effect without a manual website deployment.

## Run locally

From the repository root:

```sh
bun install --frozen-lockfile
cd projects/rawkode.academy/payload
bun run setup
bun run migrate
bun run preview
```

The preview uses isolated local D1/R2 bindings. `bun run import:static
-- --dry-run` validates the static source snapshot; `bun run import:static`
uploads its assets and imports the records. `bun run build:worker` builds the
Payload Worker deployment.

## Boundaries and rollout

- Astro SSR reads through the service-bound `PublicContentBridge`; it cannot
  query Payload's admin or arbitrary REST endpoints.
- `GET /v1/collections/:collection`, `GET /v1/assets/:id`, and
  `GET /v1/diagrams/:sourceHash.svg` expose allowlisted published data only.
- Review and account endpoints remain separate live services and do not become
  part of the public content projection.
- Pull request previews use isolated D1/R2 resources. No production route or
  production D1 is changed by preview deployment.

The historical `src/migrations/` chain remains for the existing shared Preview
database. PR preview and fresh rehearsal use `src/migrations-cuid2/`; production
selects that CUID2 chain too, but its current integer-ID D1 is rejected before
any migration write. Production needs a separately reviewed export, reimport
and matching D1 binding cutover. See
[ID-CUTOVER.md](ID-CUTOVER.md) for the rollback and verification steps.
