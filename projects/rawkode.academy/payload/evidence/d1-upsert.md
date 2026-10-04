# Reproduced D1 upsert defect and local workaround

Pinned Payload/D1 adapter 3.90.2, Wrangler 4.116.0, actual local Cloudflare workerd, 2026-10-04.

`POST /api/payload-preferences/poc-<unique-key>` with `{value:{order:"first"}}` returned HTTP 200. A subsequent authenticated GET returned `value:null`; the first-insert assertion failed. The complete test output is `d1-before-workaround.txt`. This was a real persistence check across requests, not an inference from the existing upstream issue.

Installed source has `upsert: updateOne` in `@payloadcms/db-d1-sqlite/dist/index.js`. The referenced `@payloadcms/drizzle/dist/updateOne.js` defaults `options` to `{upsert:false}` and returns null when no existing ID matches. Payload's preference operation calls `payload.db.upsert` without those options. This explains the observed missing insert. The broader [upstream issue](https://github.com/payloadcms/payload/issues/17202) provided a regression lead; this note only claims what this pinned local run established.

`src/d1-adapter.ts` wraps the official adapter's initializer and supplies `options:{upsert:true}` when the adapter's upsert method is called. It changes no installed package and leaves regular updateOne semantics unchanged. Keep this workaround visible until a verified upstream version removes the need. It does not provide atomic concurrent uniqueness or transactions, and should not be treated as production adapter certification.

`tests/worker.test.ts` retains the original assertion and additionally checks a second POST updates the same preference, a later GET observes the replacement value, and DELETE removes the fixture. The final pass/fail is recorded in `verification.json` and `worker-tests.json` after rebuilding. The test must remain when upgrading Payload or removing this workaround.
