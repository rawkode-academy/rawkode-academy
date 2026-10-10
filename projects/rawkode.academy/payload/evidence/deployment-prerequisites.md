# Deployment boundaries and cutover gates

## Pull request preview

The PR deployment uses isolated Cloudflare preview resources. Payload's admin
uses staff-authenticated REST. Astro SSR reads from the Payload
`PublicContentBridge` service binding, which exposes bounded GET-only collection,
asset and D2 diagram projections. The public Payload GraphQL endpoints are
disabled; `/graphql` on the website remains a separate website route.

The PR preview D1 uses `src/migrations-cuid2/`, the fresh schema chain with
`cuid2_...` migration names. The old `src/migrations/` history is preserved for
the existing shared Preview database. Production also selects the CUID2 chain,
but its current integer-ID D1 fails the guard before any migration writes. Every
Payload document ID is CUID2, with existing video content IDs preserved as
video primary IDs. Preview assets are seeded into the isolated R2 bucket before
the website preview is considered ready.

Review and account endpoints remain separate from the public content bridge.
The Payload `ReviewBridge` stays hard-gated to its route/method allowlist; the
Astro-to-Payload content service binding does not grant access to admin, REST,
review writes, draft content, provenance or private R2 keys.

## Production is a separate cutover

The current production D1 was created with integer document IDs. This PR must
not deploy its CUID2 schema or run its cleanup migration against that database.
The final cleanup migration intentionally drops duplicate source payload and
rebuilds the static asset tables; it is not a production rekey or a reversible
rollback mechanism.

Before production can use this schema:

1. Freeze writes and take a D1 backup. Preserve the existing D1 as the immediate
   rollback target.
2. Inventory and export Payload-authored drafts, users/auth configuration,
   review history, upload references and scheduled publication data.
3. Create a new D1 from `src/migrations-cuid2/`. Reimport static content
   and assets while retaining every slug and video R2 content ID; allocate
   canonical CUID2 IDs for other documents and rewrite all references.
4. Reconcile row counts, relationships, auth/review references, asset bytes,
   visibility and future publication boundaries. Sample the website routes.
5. Change the production D1 binding only after the rehearsal and comparisons
   pass. Keep the old D1 until rollback is no longer required.

No production D1 migration, R2 import, route change or DNS change is performed
by the PR preview workflow.
