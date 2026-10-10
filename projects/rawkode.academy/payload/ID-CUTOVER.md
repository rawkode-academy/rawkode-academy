# Payload CUID2 ID cutover

The fresh preview schema uses `TEXT` IDs for every Payload collection document
and every relationship to those documents. Import hooks generate CUID2 IDs;
videos keep their existing R2/content ID as the Payload `id`. Website slugs and
R2 object keys stay unchanged. Payload's internal relationship-row counters and
system preference/lock row IDs remain adapter bookkeeping IDs.

The current production D1 was created with integer document IDs. This change
does not migrate or write to it. The Payload Worker, static importer and
production migration command select the CUID2 chain and fail closed when they
encounter that schema. The historical `src/migrations/` chain is preserved
byte-for-byte and remains for the existing shared Preview database; the fresh
chain lives under `src/migrations-cuid2/` with `cuid2_...` names. PR preview and
fresh rehearsal select the CUID2 chain. Shared Preview selects the historical
chain. Production selects CUID2, but its current D1 is rejected before any
migration write.

Before production can use this schema, run a separate cutover with a reviewed
export/reseed rehearsal:

1. Freeze Payload writes, take a D1 backup, and retain the old D1 as the rollback
   target. Inventory editorial drafts, users/auth settings, review history,
   scheduled publications, and all relationship edges in the old database.
2. Create a new D1 from `src/migrations-cuid2/`. Import static content
   and assets, verifying every video's Payload ID equals its existing R2
   content ID and every slug/R2 key is unchanged.
3. Reimport editorial/auth/review data with CUID2 IDs and rewrite all
   collection, version, auth, review, upload, and relationship references.
   Keep durable review/publication history and scheduled timestamps. Reissue
   opaque login sessions rather than carrying sessions across the cutover.
4. Compare document and asset counts, relationship targets, publication
   visibility, scheduled release times, and sampled website routes. Switch the
   production D1 binding only after those checks pass; keep the old D1 available
   for immediate rollback.

No production rekey has been run or claimed by this PR. The export/reseed script
and a rehearsal against a production-shaped copy are required before the
production binding can move. The production migration command rejects an empty
D1 by default. During the reviewed cutover only, after provisioning the
replacement D1, update the cutover checkout's production D1 binding and its
matching expected resource ID/name, and point the checkout at that D1. An
operator can then initialize its schema with
`bun run migrate:remote -- --target=production --initialize-empty-cuid2-production`.
That explicit one-time flag is valid only for the production target; ordinary
deploy workflows do not pass it. Apply the CUID2 chain, perform the reseed and
verification above, then ship the production CUID2 chain selection and matching
new D1 binding together. Without the initial explicit operation, or if the
binding and chain disagree, the migration target guard and Worker schema guard
refuse the deployment.
