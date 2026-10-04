# Experimental MCP evaluation

Package: `@payloadcms/plugin-mcp@3.90.2`, peer dependency `payload@3.90.2` exactly. Inspected installed package source, the matching upstream tag, and [official MCP documentation](https://payloadcms.com/docs/plugins/mcp). Do not apply v4/main-branch configuration examples to this pinned v3 experiment.

Lockfile resolution inspected with `npm ls`: plugin SDK `1.30.0`, `mcp-handler@1.1.0` with nested SDK `1.26.0`, plugin Zod `3.25.76`. The app's top-level Zod `4.1.12` is not used by this MCP configuration. `npm run typecheck` passed after adding the evaluation module and test script.

## Wiring and scope

`src/mcp.ts` exports `academyMcpPlugin` for `buildConfig.plugins` and `academyMcpGlobal` for `buildConfig.globals`. The plugin registers POST `/api/mcp`; use `Content-Type: application/json` and `Accept: application/json, text/event-stream`. GET is not a discovery API. Discovery uses MCP `initialize`, `tools/list`, and `resources/list` over POST. [Pinned endpoint registration](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/index.ts).

The allowlist includes videos, articles, courses, course modules, learning paths, shows, episodes, technologies, people, chapters, and learning resources. Catalogue tools allow find/create/update; delete is disabled in configuration. The `academy-settings` singleton allows find/update. Users, API keys, private media, deletion markers, authentication management, jobs, filesystem collection/config modification, and other experimental tools are not exposed through MCP. A separate per-key capability grant is also required. Removing create/update grants makes a key read-only without changing the app configuration. Publishing is an editorial update and is enabled for granted editors in this POC; a production approval policy would need additional hooks/domain commands.

The custom `academyImportStatus` tool queries edited video counts with `req`, `user`, and explicit `overrideAccess: false`. A static `academy://compatibility/policy` resource describes provenance and public-read boundaries. These are demonstrations, not a new production workflow.

## Authentication and access

Default MCP authentication takes `Authorization: Bearer <MCP key>`. These are **not** Academy access tokens or Payload login JWTs. The generated `payload-mcp-api-keys` collection relates each key to its issuing local Payload user. Its default access confines key management to the owner and prevents changing the owner through ordinary writes. REST key issuance uses an authenticated local Payload staff JWT. [Pinned key collection](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/collections/createApiKeysCollection.ts).

The plugin resolves a keyed HMAC index, populates the key's user, and establishes that user as `req.user`. Its internal key lookup uses privileged Local API access; normal document tools explicitly use `overrideAccess: false` and the resolved user. This separation matters: do not describe the plugin as containing no privileged operations. [Authentication resolver](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/endpoints/resolveAccessSettings.ts), [create operation](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/mcp/tools/resource/create.ts).

The POC's `users` collection represents trusted local experimental staff only. Academy identity remains authoritative for any future service; no Academy login, customer membership, tenant isolation, or key revocation on upstream account disablement is integrated or proven. Before customer use, implement authenticated subject mapping and explicit revocation propagation, or use the plugin's `overrideAuth` integration point with verified identity and narrowly computed grants.

Generic update supports `where` bulk updates and defaults `overrideLock` to true. The test explicitly uses `overrideLock: false`. Disabling delete alone does not remove all destructive power: updates can unpublish/tombstone/change relationships. Narrow grants or domain-specific tools are needed for customer-facing evaluation. [Pinned update operation](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/mcp/tools/resource/update.ts).

## Audit limits

Verbose plugin logging is disabled. The `onEvent` hook records only an event type, excluding tool arguments, headers, document contents and tokens. This is diagnostic console telemetry, not durable security audit evidence. Payload document versions preserve some edit history; they are not an append-only authorization or MCP invocation audit. Production needs actor/key ID, operation, resource ID, result, timestamp and trace ID in a restricted durable audit sink. Do not log whole plugin events or raw error bodies containing submitted data.

## Workers gate and exact test

Run `npx tsx scripts/test-mcp.ts` after the app has been built for OpenNext, migrated to local D1, booted through Wrangler at `http://127.0.0.1:3100`, and local staff bootstrapped. The script requires a runtime identity containing `workerd` or `Cloudflare-Workers` plus D1/R2 bindings, reads only locally generated `.runtime/admin.json`, creates a fresh disposable key in memory, and never prints credentials. It cleans up its key and test video through authenticated REST even on a later assertion failure.

The assertions cover anonymous rejection, protocol initialization, collection/global/custom discovery, absence of delete/ungranted tools, create/update input schema fidelity, custom resource access, draft creation/read, draft exclusion from public GraphQL, publication reflected with stable legacy ID, global writes, custom access-controlled reads, per-key write revocation, and deleted-key rejection.

**Static source finding, not yet a runtime result:** `convertCollectionSchemaToZod` transpiles code with TypeScript and calls `new Function`. Its catch returns an empty permissive object. Callers spread that object's shape into a new input schema; a Workers dynamic-code failure could therefore produce a successful discovery response while losing content field definitions and stripping mutation arguments. The test explicitly checks `legacyId` and `title` in the create schema before accepting MCP compatibility. [Pinned conversion source](https://github.com/payloadcms/payload/blob/v3.90.2/packages/plugin-mcp/src/utils/schemaConversion/convertCollectionSchemaToZod.ts).

**Actual runtime result: blocked, 2026-10-04 15:47 UTC.** `node --import tsx scripts/test-mcp.ts` exited 1 against the local Wrangler Worker. Runtime returned `Cloudflare-Workers` and live D1/R2 bindings. Local staff login, anonymous MCP rejection, and authenticated REST key creation succeeded. Authorized MCP `initialize` failed with non-JSON HTTP 500 on the bounded rerun; the earlier run eventually returned HTTP 503. The Wrangler log at 15:46:12.081 UTC reported: `The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response.`

The precise cause of the initialization hang is unestablished. It occurs before authorized discovery, so collection/global MCP reads, writes, custom resource access, publication, and grant-revocation protocol behavior were **not reached**. The schema-conversion finding above remains a separate static risk, not an explanation proven by this run. Both disposable keys were revoked by cleanup; a follow-up authenticated query confirmed zero matching test keys. No production resources were touched. Machine-readable evidence: [`mcp-runtime.json`](mcp-runtime.json).

The first sandboxed `npx tsx` attempt hit an IPC permission error and a sandboxed Node fetch could not reach localhost. The actual test was run with approved local host access using `node --import tsx`; those environment restrictions are not attributed to Payload. The script now bounds requests at 20 seconds and consumes MCP SSE responses by matching JSON-RPC ID.

## Decision and fallback

Do not replace a bespoke production MCP service with this pinned package on Workers: the required runtime gate failed. Exclude the plugin from the default deployable bundle and retain the evaluation module/test behind the explicit optional build setup documented in the README. Continue using compatibility GraphQL and authenticated Payload REST/admin. A separate Worker-native MCP adapter could later expose a narrow set of reviewed domain commands through those authenticated boundaries; that fallback is not implemented here. Do not enable unsafe evaluation or weaken access controls to make this package pass.
