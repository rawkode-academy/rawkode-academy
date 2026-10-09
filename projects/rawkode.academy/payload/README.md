# Payload catalogue / Cloudflare Worker Preview

**Decision: continue the isolated catalogue experiment; do not replace the public gateway yet.** Payload editing, D1, R2 and the generated GraphQL API work in local workerd. The public compatibility facade preserves the captured gateway schema, but external domain resolvers are incomplete. Academy OIDC is now implemented for preview/Payload sessions; successful live sign-in remains unverified. The official MCP plugin failed its Workers initialization gate and is excluded by default. The named non-production Preview now runs the real Container/Workers AI media path for the checked-in synthetic fixture; production media remains gated.

This is the first Academy checkout integration of the Payload catalogue experiment and video-review foundation. It is deliberately additive: the existing public gateway and domain services remain authoritative while this project is evaluated. No production route, DNS change, production mutation, real email, private media import or copied production credential is part of this change. A named Cloudflare Worker Preview has been smoke-tested from the PR deployment path with isolated preview D1/R2 resources. All fixture records are synthetic; only public schema/source reads informed the model. `.dev.vars`, `.runtime`, `.wrangler`, build products and dependencies are local ignored state.

## Run locally

The experiment was originally verified with Node 26.10.0, Payload 3.90.2, Next 16.3.8, OpenNext Cloudflare 1.20.1, Wrangler 4.116.0, GraphQL 16.14.2 and React 19.3.0. The project now pins Wrangler 4.147.0 because Cloudflare Worker Previews require Wrangler 4.135.0 or later. Exact workspace dependencies are locked in the repository `bun.lock`.

From the repository root:

```sh
bun install --frozen-lockfile
cd projects/rawkode.academy/payload
bun run setup
bun run migrate
bun run build:worker
bun run preview
```

The default preview uses Academy OIDC and disables password login, reset and bootstrap. Open [the account page](http://127.0.0.1:3100/account). See [OIDC setup and evidence](evidence/oidc-integration.md) for the exact client registration, staff allowlist and tests. Live end-user sign-in and production admin routing remain unverified.

For the original synthetic editorial tests only, stop preview and explicitly opt into local staff fallback:

```sh
bun run preview -- --var POC_DEV_LOCAL_AUTH:true
```

Keep that explicitly flagged preview running. In another terminal:

```sh
bun run bootstrap
bun run import -- --dry-run
bun run import
bun run check:schema
bun test
bun run test:worker
bun run test:pipeline
bun run test:admin
```

`setup` creates fresh local secrets and `.runtime/admin.json` with generated staff credentials. `bootstrap` requires the explicit development flag, registers the initial local staff account and verifies login without printing its password. Read that local file to log into [the admin](http://127.0.0.1:3100/admin). Never include it in an archive. The browser test uses macOS Google Chrome by default; set `CHROME_PATH` to another installed Chromium executable where necessary.

`bun run dev` uses Next's Node development server and is only a convenience. **It is not Workers evidence.** Use the OpenNext build and `wrangler dev --local` above for acceptance. Run migrations with the preview stopped to avoid local D1 lock contention. Build uses a separate ephemeral binding proxy to prevent concurrent Next build workers from sharing the persistent SQLite file. A Workflows-binding warning during the build proxy does not represent the actual preview: `preview` binds `MediaWorkflow` through the custom Worker entry point.

The checked-in config keeps local bindings at the top level and defines an explicit `previews` block. Worker Previews use separate preview-safe D1/R2 resources, which are declared in `wrangler.jsonc`; provision equivalent resources before deploying from another account. The preview task is invoked by the cuenv pull-request pipeline and uses `wrangler preview`, not the older `versions upload` flow. Removing `.wrangler/state` discards this experiment's local database, media and workflow state; archive it first if you want the generated test data. Regenerate local state through migrations/bootstrap/import instead of copying anyone else's credentials.

Cloudflare's [Worker Previews](https://developers.cloudflare.com/workers/previews/) provide the PR environment. The [configuration model](https://developers.cloudflare.com/workers/previews/configuration/) does not inherit production variables or storage bindings, so this project keeps preview resources explicit. The existing Workflow is referenced from the preview binding; Cloudflare does not create a new Workflow per branch.

## Boundaries and API routes

```mermaid
flowchart LR
  Admin[React Payload admin] --> REST[Staff REST and generated GraphQL]
  Import[Synthetic snapshot importer] --> REST
  REST --> Payload[Payload collections / D1]
  Client[Existing public GraphQL clients] --> Compat[Captured-schema compatibility facade]
  Compat --> Published[Anonymous published-only catalogue]
  Published --> Payload
  Upload[Private immutable upload] --> R2[Local R2]
  Payload --> Workflow[Native Cloudflare Workflow]
  Workflow --> Processors[Parallel Container + Workers AI processors]
  Processors --> Review[Human revision and explicit approval]
  Review --> Payload
```

| Route | Contract |
| --- | --- |
| `POST /`, `GET /?query=...`, `/graphql` | Academy-compatible, query-only GraphQL. Root routing preserves the existing gateway URL shape. Plain `GET /` shows the experiment page. |
| `/api/graphql` | Payload-generated schema and authenticated catalogue mutations. Deliberately separate from the public contract. |
| `/api/{collection}` | Payload REST. Staff CRUD; public catalogue reads filter drafts/tombstones. |
| `/admin` | Stock React/Next Payload admin with Academy OIDC staff authorization. |
| `/api/poc/import` | Staff-only snapshot import, served on loopback only (404 on deployed Workers). No remote source fetching; dry-run supported. Remote imports use the `--target` CLI. |
| `/api/poc/pipeline` | Staff registration, resume, review edit and approval commands. |
| `/api/poc/pipeline/callback` | Separate local machine secret for Workflow results. |
| `/api/poc/runtime` | Local runtime/binding probe. |
| `/api/mcp` | Absent by default following failed Workers evaluation. |
| `/api/editorial/times` | Staff-only read and guarded commands for a video's editorial times (schedule, correct). Admin host only. |
| `/api/editorial/broadcast` | Rawkode Studio's signed machine route for `broadcast-started` and `broadcast-ended`. |
| `/api/review/queue`, `/api/review/staff` | Staff-only review queue with derived statuses and the assign picker's staff directory. Admin host only. |
| `/api/published/v1/videos[/{legacyId}]` | Published read contract v1. Served only through the `PublishedContent` service binding entrypoint; every public host answers 404. |

OIDC users default to customers. Only subjects explicitly listed in `OIDC_STAFF_SUBJECTS` receive staff access. Identity mapping uses issuer and subject, never email. Local password accounts are available only with the explicit development flag and loopback callback configuration. Source media is private and immutable through the API after upload. Public catalogue metadata does not grant access to private R2 objects. The named Preview has authenticated private playback and published byte-range delivery for the verified synthetic workflow; this is not yet a production watch-page integration.

## Model and import rules

| Collection | Mapping and relationship strategy |
| --- | --- |
| `videos` | Existing IDs, slugs, dates, categories/types, text/terms, URLs; ordered guests, technologies and chapters; explicit episode. |
| `people` | Names, biography, links, source GitHub/avatar metadata; reverse appearances/hosted shows resolve publicly. |
| `technologies` | Taxonomy, aliases, links, feature/use-case lists and learning resources. |
| `shows`, `episodes` | Stable IDs, show hosts, source episode code and video relationship. `Episode.show` is authoritative for public show episodes; imported `Show.episodes` is read-only in admin. |
| `chapters`, `learning-resources` | Chapter time/title; official/community/tutorial URL lists. |
| `articles` | Text/source body, publication date, authors, technologies and resources. |
| `courses`, `course-modules` | Ordered module relationships, course/video/resources, section/order and source body. |
| `learning-paths` | Ordered courses/videos, technologies, prerequisites, difficulty and duration. |
| `series`, `adrs`, `testimonials`, `news`, `changelog` | Static editorial records with source frontmatter/body retained for editing and reconciliation. |
| `static-assets` | Local Astro assets uploaded to checksum-addressed R2 keys with source paths and checksums. |
| `seasons`, `competitors`, `brackets`, `bracket-applications`, `teams`, `team-members`, `bracket-breaks`, `bracket-entries`, `matches`, `match-results` | Pre-launch Klustered competition data imported by stable source IDs and linked relationships. |
| `team-invites`, `registrations` | Sensitive Klustered records; excluded by default and imported only with an explicit `--include-sensitive` gate. |

All catalogue and Klustered collections support Payload versions/drafts where editorial review is useful. REST and generated GraphQL expose real editing and mutations. `sourceBody` preserves source Markdown/MDX verbatim, while `sourceData` preserves the original frontmatter/YAML object. The static importer walks the repository content tree, derives chapters and learning resources, records local assets, and can upload them to R2. The Klustered exporter reads the existing `platform-brackets` D1 database into a stable JSON snapshot. Existing stream/thumbnail URLs are retained as data; media is not fetched automatically as part of this migration.

The complete migration procedure, sensitive-data gate, reconciliation requirements and rollback are documented in [content migration evidence](evidence/content-migration.md).

`legacyId` is a unique string within its collection and is returned by the compatibility layer. Numeric Payload database IDs stay internal. New editorial records need a deliberate legacy ID, legacy type and slug. Publication does not mint replacement public IDs. URL redirect/slug-change policy still needs production decisions.

Importer input is `{sourceSystem,mappingVersion,sequence,records}`; each record carries `collection,legacyId,legacyType,slug,sourceRevision,status,data,relationships`. References use `{collection,legacyId}`. See `fixtures/catalogue.json` for the exact format. The CLI only permits loopback targets; `--file=/absolute/snapshot.json` selects an explicit local snapshot.

- Validate identifiers, reserved fields and relationship shapes before writes. Hash canonical mapped source content, including source order and mapping version.
- Create/stage nodes first, then resolve relationships and publish complete records. Valid cycles and array order survive. Missing or tombstoned dependencies propagate to dependent pending records; replay resolves them when the missing source arrives.
- An unchanged completed snapshot is a no-op. Changed content needs a higher source sequence; stale/inconsistent sequences conflict. Prior source fields cannot disappear silently: clear them explicitly with `null` or `[]`.
- Editorial changes mark `locallyEdited`; subsequent imports report conflicts without overwriting them. Import provenance cannot be rewritten through normal editing. No automatic conflict merge is provided.
- Deletion creates a durable marker. Reimport cannot resurrect that ID. Reconciliation is deliberately manual. Source deletions require explicit tombstone records; omission from a snapshot never deletes content.
- Imports are **serialized, per-record and non-atomic**. Use an exclusive import window with no simultaneous editorial/import writes. A failed run leaves resumable pending drafts; a previously published version can remain visible until a replacement is completed. There is no transaction spanning the whole graph and no D1 compare-and-swap guarantee against concurrent editors.

## Admin experience

The admin is configured without any schema change. `tests/admin-config.test.ts` compares the stored data shape against `fixtures/admin-field-shape.json`, which was captured before the admin work. It allows only the virtual title fields `competitorName`, `videoTitle` and `label`. `bun run migrate:create` reports "No schema changes detected".

- **Where a collection appears.** Every slug has a preset in `src/admin/collection-admin.ts`, which sets the nav group, description, `useAsTitle`, list columns, search fields and pagination. `labels` and `defaultSort` go on the top-level collection config. A collection without a preset makes `createCollections` throw.
- **Nav order.** Groups follow `NAV_ORDER`: Publishing, Learning, People, Media, Klustered, Site and System. `collectionOrder` in `src/collections.ts` lists the collections group by group. Collections with `group: false` (the review audit tables and chapters and learning resources, which are edited from their parent) can still be opened by route but are left out of the nav. Klustered child records (match results, team members, bracket entries and breaks) stay in the Klustered group because no parent links to them. Keep `bracket-applications`, `team-members` and `bracket-entries` in their current relative order. Payload numbers their shared compound index names by collection order, so reordering them would rename those indexes.
- **Developers.** `DEVELOPER_SUBJECTS` uses the same strict JSON-array format as `OIDC_STAFF_SUBJECTS` (for example `["subject"]`), and every entry must also be a staff subject. A malformed value stops the app at startup. Developers see the System group, Registrations and each record's read-only Source tab (import provenance, including `tombstone`). There is no gear-menu entry: Payload draws the gear whenever `settingsMenu` is configured, which left other staff an empty popup. Other staff see none of these, and the developer-only list routes return 404 for them. Loopback local accounts count as developers only when `POC_DEV_LOCAL_AUTH=true`. This setting controls admin visibility only and grants no data access.
- **Editor creates.** `legacyId` defaults to `payload:<slug>:<uuid>`, and `legacyType` defaults to the importer's singular name. Both defaults are functions, so they add no column `DEFAULT`. If `slug` is left empty on an editorial create, it is generated from the title. Imports keep their explicit values.
- **Review.** The Review block at the top of the nav, the `/admin/review` view, the dashboard widget and the video Review tab read `src/review/queue.ts`; open-comment counts cover the current revision only, as the publish guard does. Each row carries guarded staff actions (`src/admin/fields/ReviewActions.tsx`): assign an owner, share the current cut with a client (the `share` command) and publish an approved cut after a confirmation. Every action posts to `POST /api/review`, which re-checks every guard. A video with a `video_review_state` row is frozen by the `review_freeze_*` triggers, so its edit view shows an "In client review: read-only" notice and disabled Save draft and Publish buttons.
- **Times.** The video Times tab is a `ui` field (no column, no GraphQL shape) that reads and writes editorial times through `/api/editorial/times`. It works on review-frozen videos too, because the times live outside the document.
- **importMap.** After adding or moving an admin component, run `bun run generate:importmap` and commit `app/(payload)/admin/importMap.js`. `bun run check:importmap` (also run by `test` and `build:worker`) fails when a component path is missing. Without that check, the production Worker would silently drop the component.
- **Theme.** `app/(payload)/custom.css` is plain, unlayered CSS that mirrors `semanticTokens.academy` from `packages/design-system/panda.config.ts`. `tests/admin-theme.test.ts` checks for token drift, checks that the ramps are complete and enforces WCAG AA contrast in both themes. The theme follows the OS setting.
- **Screenshots.** Run `bun run dev` with `POC_CLOUDFLARE_PERSIST_PATH` and `POC_CLOUDFLARE_ENV_FILE` pointing at scratch state, using local auth and the loopback callback. Never point them at `.wrangler/state`. Afterwards, restore `next-env.d.ts` with `git checkout`.

## GraphQL compatibility

The public gateway at `https://api.rawkode.academy/`, deployed website subgraph and pinned repository schema were independently captured on 2026-10-04. Public source revision: `31edd9fd9d86c21a7e9a3a34cfe1933b44e99598`. Evidence includes raw introspection, SDL, checksums and representative operations. `capture:schema` deliberately refreshes these public baselines; ordinary checks do not update them.

`src/compat.ts` builds the facade from captured gateway introspection. This preserves String versus ID distinctions, nullable roots, bare-list responses, arguments/defaults, enums, Date/DateTime and directive definitions. GraphQL 16.14.2 is necessary to retain the captured directive locations. The current gateway has no Mutation root; staff mutation support is exclusively in the generated Payload API.

| Surface | Result / limit |
| --- | --- |
| Gateway schema | Exact SDL/directive comparison and zero breaking/dangerous changes against the dated capture. Schema equality alone is not behavioral parity. |
| Catalogue roots and traversal | Existing IDs, source ordering, relationship order, null/missing behavior and date conversion exercised. Latest/search/random exclude future dates; all-videos preserves source behavior. |
| Pagination/search | Source `Array.slice` offset/limit semantics retained, including zero/negative/null cases. Case-insensitive substring search uses title/subtitle/description. |
| Random | Membership/count preserved; Fisher-Yates replaces the source random comparator. Exact selection order is unspecified. |
| Drafts and relationships | Anonymous, published-only, non-tombstoned reads; targets are re-read through access checks. No staff request/session flows into this facade. |
| Articles/courses/paths | Editable in Payload; absent from the existing gateway schema and therefore not added implicitly. |
| `me` | Always `null`. Identity headers do not impersonate a customer. **Blocks authenticated-client replacement.** |
| Reactions, watch history, preferences, brackets/seasons | Schema retained; explicit `DOMAIN_NOT_IMPLEMENTED` errors. **Blocks full gateway replacement.** |
| Subgraph drift | `getUpcomingVideos`, `personByGithub`, Person GitHub/avatar fields and federation internals are not in the captured gateway facade. This is not a drop-in federation-subgraph implementation. |

The adapter currently reads required collections in batches of 100 and caches only within a request. Full catalogue performance, query cost controls, caching/invalidation and published endpoint behavior are unmeasured. Episode IDs/codes are imported explicitly; future editorial episode lifecycle invariants need domain commands. Details: `evidence/schema-semantics.json`, `evidence/schema-compatibility.json` and `fixtures/schema-operations.graphql`.

## Media orchestration and MCP result

The native Workflow verifies source bytes, forks Container encoding and Workers AI transcription, joins the verified result, and attaches it to a human review revision. The hosted named Preview completed the full synthetic path, including private intake, timestamped comments, exact-revision approval, publication and byte-range playback. The one-second synthetic MP4 is not a claim about arbitrary customer media; production capacity, quotas, and footage acceptance remain separate gates.

A run is keyed by video/version/checksum; a new cut requires a new private video record in this POC. Completed machine callbacks cannot overwrite reviewed state. Human summary edits change the approval revision. Approval rechecks source bytes and the review revision, creates chapters and publishes metadata; stale approval and generic publication of linked pipeline videos are rejected. Approval/edit/registration still require serialized operation: read-then-write checks are not an atomic concurrency protocol. There is no complete immutable `video_versions` product model yet.

[Target media provider plan](evidence/media-providers.md) covers Workers AI Whisper, Workers AI Llama, Container/Sandbox ffmpeg, chunking, provenance, retries and cloud acceptance gates. The Whisper/Container adapters are implemented and verified in the named non-production Preview for the synthetic fixture; real customer footage, capacity and production publication remain unverified.

The official `@payloadcms/plugin-mcp` configuration was built and exercised in workerd. Staff authentication/key creation and anonymous denial passed, but authorized `initialize` failed with HTTP 500 (an earlier run ended 503); workerd reported a hung request. Discovery and read/write tools were never reached. No MCP replacement is justified. Disposable test keys were removed. See [MCP findings](evidence/mcp-notes.md) and `evidence/mcp-runtime.json`.

The installed package remains pinned for reproduction, but `src/optional-mcp.ts` has no runtime import of it. To reproduce only in this disposable local environment, stop preview, run `node scripts/enable-mcp.mjs --enable`, build/preview, then `npm run test:mcp`. Disable again with `node scripts/enable-mcp.mjs` and rebuild. The schema includes unused MCP evaluation tables. Never infer MCP support from installation or a successful build.

## Studio handoff and machine authentication

Rawkode Studio hands a `reviewRequired` recording to review without a browser. Studio calls `POST /api/studio-handoff/adoptions` (adopt) and `GET /api/studio-handoff/adoptions?adoptionId=` (status) over its `PAYLOAD` service binding to this Worker's default entrypoint. Payload adopts the private `studio/recordings/{session}/{recording}/` source and the transcoder's `review/{execution}/review.mp4` in place through a read-only `STUDIO_CONTENT` facade (head and get only), records an adoption row, and creates the revision as the system principal `system:rawkode-studio` once the deliverable is verified. Adopted revisions are never auto-granted; staff share them as usual. Staff see stuck or unpublished adoptions at `GET /api/review/studio-adoptions`. Every status call re-reads the transcoder's `review/transcode-status.json`; a `queued` or `running` status more than 4 hours old (the task timeout is 3 hours) is reported as `failed`, so Studio re-triggers a transcode that was killed without writing a terminal status. Neither route is in the preview bridge table.

A Studio revision publishes to `https://content.rawkode.academy/videos/{legacyId}/stream.m3u8`. Its review.mp4 stays private and `published-media` refuses to serve it; Studio's cron sees the publication and promotes the approved source to public HLS, without the raw source or `original.mkv`.

Every Studio-to-Payload call, including the broadcast-time calls at `/api/editorial/broadcast`, uses one scheme implemented in `src/machine-auth.ts`:

- HMAC-SHA256 with `STUDIO_MACHINE_SECRET`, one Cloudflare Secrets Store secret (store `492e5e40b9d64ebeac7e7a77db91ff6e`) bound by both Workers.
- The canonical string is the scheme name, method, a route path constant fixed by the receiving route (never `request.url`, so OpenNext rewrites cannot change it), the sorted query, the principal, the unix timestamp, the `Idempotency-Key` header and the body's sha256, joined by newlines. The signature is sent as `x-rawkode-signature: v1=<hex>` with `x-rawkode-principal` and `x-rawkode-timestamp`.
- A request older or newer than 300 seconds is refused. Every non-GET request needs an `Idempotency-Key`, which is signed, and the endpoint must make a repeated key return the original result, so a replay inside the window changes nothing.
- The endpoints answer 503 when the secret or bindings are absent (PR previews), 401 for a bad, expired or cookie-bearing request, and 413 above 16 KiB.

To add an endpoint, pick a path constant, call `verifyMachineRequest` with it and the principal before doing any work, and make the operation idempotent on the key. `MACHINE_AUTH_TEST_VECTOR` must stay byte-identical with Studio's client in `projects/rawkode.studio/src/server/machine-auth.ts`.

## Editorial times, review queue and published contract

**Editorial times.** `scheduledStartAt`, `broadcastStartedAt`, `broadcastEndedAt` and `publishedAt` live in `video_editorial_times`, a side table keyed by `videos.id` (migration `20261009_150000_editorial_times`). The review freeze triggers refuse every write to `videos` for a reviewed video, so the times are written only by guarded, idempotent, journaled commands in `src/editorial/times.ts` (a guard row, a version fence, the `editorial_commands` journal and immutable `editorial_time_events` history). There is no import backfill. One effective rule (`src/editorial/effective.ts`) applies everywhere:

- `publishedAt` is the first-ever public release: the stored value, else the imported `publishedAt` of a video published in Payload. It is stable across republishes. Review publish writes it once (`COALESCE`) and puts it in the projection, while `review_publication_events` keeps each release's own time. Publish stays immediate.
- `scheduledStartAt` is the stored value, else the imported `publishedAt` of a live video. Clearing a schedule falls back to that imported value.
- Broadcast times come only from the side table: Rawkode Studio records them, staff `correct` them with a required note. `correct` cannot change `publishedAt`.

Studio sends `broadcast-started` and `broadcast-ended` to `POST /api/editorial/broadcast`, signed with the shared `STUDIO_MACHINE_SECRET` scheme below (path constant `/api/editorial/broadcast`, `Idempotency-Key` equal to the body's `commandId`). Videos are addressed by `legacyId` (Studio's content video ID); `videoId` is also accepted. Only `type: live` videos take broadcast times, a start may arrive without a schedule (ad hoc shows), times must be within the last 24 hours and at most 120 seconds ahead, a start after the recorded end is a restart (the first start stays and the end is cleared), any other different second start or end is a 409 that staff resolve with `correct`, and a version race with a staff edit is retried internally and then answered 503 so Studio's outbox retries. No new secret is needed: previews without the secret answer 503.

Hard deletes of managed videos (review, editorial or Studio rows) are refused with 409 before Payload writes a deletion marker; tombstone them instead.

**Review queue.** `src/review/queue.ts` derives one status per reviewed video, checked in order: processing, no cut, published, changes requested, approved with open comments, ready to publish, approval invalidated, needs sharing, awaiting client. Grant-derived columns come from `ReviewAccess.queueColumns`, so only `src/review/access.ts` names the grant table. `assign` is a review command (`review_assignments`, staff only, version fenced; system principals are never assignable). The view also lists a broadcast calendar of scheduled and running live videos, with or without review.

**Published read contract v1.** `src/published/contract.ts` defines `PublishedVideoV1` and `PublishedVideoListV1` (zod, strict) and documents each field. The website does not consume it yet (workstream G5). It is served only by the `PublishedContent` WorkerEntrypoint in `worker.ts`: bind `rawkode-academy-payload` with `entrypoint: "PublishedContent"` and request `GET /api/published/v1/videos?include=upcoming,live,ended&cursor=&limit=` or `GET /api/published/v1/videos/{legacyId}` on any host. The default entrypoint (admin, previews) and the review bridge answer 404 for `/api/published/`. Responses are anonymous (credentials are stripped), validated against the schema before they are sent, cached in the Workers Cache API and revalidated by ETag. Nothing purges that cache, so a published, unpublished or tombstoned video reaches the contract within 30 seconds (15 seconds while any listed video is live or upcoming). A started broadcast with no end becomes `ended` after 12 hours.

## Verification and migration gates

`evidence/verification.json` records the original catalogue run; [OIDC verification](evidence/oidc-verification.json) records the current auth changes and fresh regression results. `npm test` covers semantic GraphQL and OIDC protocol tests. `npm run test:worker` covers actual Worker/D1/R2 catalogue integration and requires the explicit local staff fallback. `test:oidc:worker` exercises the OIDC-only default with locally seeded sessions. `test:worker` is the integration-only subset; `demo:mutations` is its alias and creates disposable synthetic data. `test:pipeline` covers native Workflow retry, review and approval. `test:admin` logs in, creates/edits a draft and confirms reload persistence in Chrome; its screenshot is `evidence/admin-edit-view.png`. Repeated tests add uniquely named fixture records to local state.

The official [Cloudflare D1 template](https://github.com/payloadcms/payload/tree/v3.90.2/templates/with-cloudflare-d1) informed the runtime setup. It calls for a paid Workers plan and warns that GraphQL support on Workers is not guaranteed. Our generated GraphQL query/mutation evidence applies to these pinned versions in local workerd only. [D1 read replicas](https://payloadcms.com/docs/database/sqlite) remain experimental and disabled. The pinned D1 adapter required an explicit [insert-on-miss workaround](evidence/d1-upsert.md) after the preference regression test reproduced HTTP success without persistence; the final build uses `src/d1-adapter.ts`. This is additional maintenance burden, not an unmodified upstream success. Known reports about [blank edit views](https://github.com/payloadcms/payload/issues/15712) and [D1 upsert persistence](https://github.com/payloadcms/payload/issues/17202) motivated targeted checks; passing local tests does not close those upstream issues or establish cloud deployment compatibility.

Recommended coexistence: keep the existing gateway and interaction/preference/competition services authoritative while evaluating a Payload-backed catalogue boundary. Do not dual-write the catalogue. Before any cutover:

1. Complete an actual public-source exporter, reconcile every ID/slug/relation/body and count at a source watermark, and resolve conflicts explicitly. Measure representative catalogue queries at full volume.
2. Either preserve federation by implementing/verifying a catalogue subgraph or route every external domain through verified existing services. Integrate Academy identity and cross-domain authorization. Exact public SDL is necessary but insufficient.
3. Create an explicitly isolated paid cloud environment and verify migrations, D1 persistence, R2 access, admin, generated GraphQL, Workflow recovery and routing there. Add atomic domain concurrency controls and an audit trail before multiple writers.
4. Run real consumer operations against both old and candidate endpoints, compare data/errors/URLs, and rehearse a bounded switch with a write freeze and source watermark. Keep the old authority available for rollback.
5. Roll back by stopping candidate writes, exporting/reconciling every accepted post-watermark edit, then restoring routing to the previous authority. Restoring an old database alone loses edits; dual writes are not a rollback strategy.

The local POC and named Preview are a **go for further catalogue and review-workflow work**, a **no-go for public gateway cutover**, a **no-go for official MCP replacement on Workers**, and a **no-go for production media processing** until the documented gates pass.

[Frontend design note](evidence/frontend-architecture.md): supported React/Next Payload admin; proposed Vue/Nuxt customer preview; `live-preview-vue`; shared Panda CSS v2 tokens/recipes/CSS and framework-specific Ark UI components. The stock admin and a minimal account/sign-in page exist here.

[Optional stretch inventory](evidence/stretch-inventory.md): source-backed marketing/customer preferences, provider-abstracted Workers email and seasons/brackets planning, with identity/consent/command dependencies, acceptance and rollback. Nothing was migrated or sent. “Custard” remains ambiguous; the note identifies the evidenced Klustered domain without assuming equivalence. Stretch work is not a prerequisite for this catalogue experiment.

Deployment coordination: see [admin hostname prerequisites](evidence/deployment-prerequisites.md). That note predates the production admin route and is stale. The PR path now deploys a named Cloudflare Worker Preview with isolated preview D1/R2 resources. The production `admin.rawkode.academy` route, staff allowlist and customer data remain intentionally unconfigured; complete those gates before treating the admin as live.
