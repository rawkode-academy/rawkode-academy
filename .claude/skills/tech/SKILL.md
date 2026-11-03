---
name: tech
description: Research, validate, and set up technology profiles as platform-technologies D1 rows (logos in R2). Handles both new entries and updates to existing ones.
license: Complete terms in LICENSE.txt
---

# Rawkode Academy Technology Profiles

Technology profiles are rows in the `platform-technologies` D1 database
(`projects/rawkode.academy/platform/technologies`), served through the GraphQL
gateway (`https://api.rawkode.academy`) to the website. Logos live in the R2
bucket `rawkode-academy-content`. The repository has no technology files any
more: never create or edit Markdown/MDX for a technology.

When the user asks to add or check a technology (e.g. "Add Bun", "Check
Kubernetes"), follow this process.

## 1. Research & Discovery

Research only from primary project sources: the official site, documentation,
source repository and official licensing information. Gather:

- **Official name** and a concise, objective description of what it is.
- **Official website** and **documentation** URLs.
- **Source repository** (GitHub/GitLab) and **license** (SPDX id, e.g. `Apache-2.0`, `MIT`).
- **Logos**: official vector logos (SVG) for `icon`, `horizontal` and `stacked`, with provenance (the URL you took each from).
- **Key features**, **use cases**, **core concepts** and **ecosystem** (related tools or integrations).
- **Spellings** people say or mistype (the name, product names, CLI names): these become transcription terms.

Prefer primary sources and distinguish verified facts from uncertain claims.

## 2. Check Existence

The id is the kebab-case public slug (`kubernetes`, `bun`). Check the live API
first, then the database:

```bash
curl -fsS https://api.rawkode.academy/ -H 'content-type: application/json' \
  --data '{"query":"query($id:String!){ technologyById(id:$id){ id name website documentation source license status category subcategory logos { icon horizontal stacked } } }","variables":{"id":"<id>"}}'

cd projects/rawkode.academy/platform/technologies
cuenv exec -e production -- bunx wrangler d1 execute platform-technologies --remote \
  --config read-model/wrangler.jsonc \
  --command "SELECT id, name, website, documentation, source, license, status, category, subcategory, logos, updated_at FROM technologies WHERE id = '<id>' OR name = '<Name>'"
```

Read nearby technologies (same category) the same way for prose and metadata
conventions. The allowed values for `status`, `category`, `subcategory` and
`matrix` live in `projects/rawkode.academy/website/src/lib/explorer/dimension-values.ts`;
the column shapes in `projects/rawkode.academy/platform/technologies/data-model/schema.ts`.

## 3. The Row

Table `technologies` (D1 `platform-technologies`). JSON columns are stored as
JSON text.

| Column | Notes |
|---|---|
| `id` | kebab-case slug, primary key |
| `name` | official name, unique |
| `description` | the profile body in **Markdown** (NOT NULL; kept until every reader uses `body`) |
| `body` | the same profile as a TipTap/ProseMirror JSON document (see 4) |
| `website`, `documentation`, `source` | URLs |
| `license` | SPDX id, default `Unknown` |
| `status` | `alpha`, `beta`, `stable`, `preview`, `superseded`, `deprecated` or `abandoned` (default `stable`) |
| `category`, `subcategory` | one singular value each |
| `aliases`, `related_technologies`, `use_cases`, `features` | JSON string arrays (`related_technologies` holds technology ids, no `/index`) |
| `learning_resources` | JSON `{ "official"?: [], "community"?: [], "tutorials"?: [] }` |
| `logos` | JSON `{ "icon"?: true, "horizontal"?: true, "stacked"?: true }`: set a flag only once that file is in R2 |
| `cncf`, `community`, `seo` | JSON objects (keys in `data-model/schema.ts`) |
| `matrix` | JSON; required `status` (`skip`, `watch`, `explore`, `learn`, `adopt`, `advocate`, `graveyard`, `guilty-pleasure`), optional `grouping` (`plumbing`/`platform`/`observability`/`security`), `confidence` (`gut`/`some-experience`/`deep-experience`), `trajectory` (`rising`/`stable`/`falling`) |
| `updated_at` | milliseconds: `CAST(strftime('%s','now') AS INTEGER) * 1000` |

Add optional fields only when verified and useful. Do not add obsolete fields
(`categories`, `radar`).

Transcription spellings are rows in `platform-transcription-terms`, table
`transcription_terms` (`kind` = `'technology'`, `foreignId` = the technology id,
`term`).

## 4. Rich Text

`body` is a TipTap document as written by `@rawkodeacademy/rich-text`. Write the
profile as Markdown (concise, objective, grounded in the sources; for a new
profile, sections such as *What is X?*, *Core concepts*, *Getting started*,
*Common use cases*, *Ecosystem*), then convert and validate it:

```bash
cd packages/rich-text
bun -e 'import { fromMarkdown } from "./src/markdown/index.ts"; import { validateDoc } from "./src/schema.ts"; const file = process.argv[1]; const doc = fromMarkdown(await Bun.file(file).text(), { mdx: false, file }); validateDoc(doc); console.log(JSON.stringify(doc));' /absolute/path/to/body.md > /absolute/path/to/body.json
```

Store the Markdown in `description` and the JSON in `body`. Never hand-write
the JSON; a document `validateDoc` rejects must not be stored.

## 5. Write

Write the SQL to a file outside the repo (single quotes doubled inside string
literals, JSON as text), review it, then apply it:

```sql
INSERT INTO technologies (id, name, description, body, website, documentation, source, license, status, category, subcategory, logos, updated_at)
VALUES ('bun', 'Bun', '<markdown>', '<body json>', 'https://bun.sh', 'https://bun.sh/docs', 'https://github.com/oven-sh/bun', 'MIT', 'stable', '<category>', '<subcategory>', '{"icon":true}', CAST(strftime('%s','now') AS INTEGER) * 1000);
```

For an update, `UPDATE technologies SET <only the corrected columns>, updated_at = CAST(strftime('%s','now') AS INTEGER) * 1000 WHERE id = '<id>';`
(for one JSON key: `logos = json_set(coalesce(logos, '{}'), '$.stacked', json('true'))`).

```bash
cd projects/rawkode.academy/platform/technologies
cuenv exec -e production -- bunx wrangler d1 execute platform-technologies --remote --config read-model/wrangler.jsonc --file=/absolute/path/to/technology.sql

cd ../transcription-terms
cuenv exec -e production -- bunx wrangler d1 execute platform-transcription-terms --remote --config read-model/wrangler.jsonc \
  --command "INSERT OR IGNORE INTO transcription_terms (kind, foreignId, term) VALUES ('technology', '<id>', 'Bun'), ('technology', '<id>', 'bunx')"
```

## 6. Logos

Upload verified SVGs to R2 before setting their `logos` flags. Keys are
`technologies/<id>/icon.svg`, `technologies/<id>/horizontal.svg` and
`technologies/<id>/stacked.svg` (served at `https://content.rawkode.academy/<key>`):

```bash
cuenv exec -e production -- bunx wrangler r2 object put rawkode-academy-content/technologies/<id>/icon.svg \
  --file=/absolute/path/to/icon.svg --content-type=image/svg+xml --remote
curl -fsS -I https://content.rawkode.academy/technologies/<id>/icon.svg
```

Never invent logos, download them without provenance or upload placeholders.
If no official asset exists, leave the flag unset and tell the user which
variants are missing.

## 7. Invalidate the Website Cache

After every D1 write or logo upload:

```bash
curl -fsS -X POST https://rawkode.academy/api/cache/invalidate \
  -H "Authorization: Bearer $CACHE_INVALIDATION_TOKEN" \
  -H 'content-type: application/json' \
  -d '{"tags":["technologies:<id>"]}'
```

(`just invalidate-content '{"tags":["technologies:<id>"]}'` in
`projects/rawkode.academy/website` does the same.) The endpoint takes a while
to answer (it purges twice, ~50s apart). Without the token the change shows up
after the website's hourly change detection; say so.

## 8. Validate & Update (if it exists)

1. Read the row (step 2) and the rendered page `https://rawkode.academy/technology/<id>`.
2. Compare `website`, `documentation`, `source` and `license` with your research; check the profile for outdated versions, years or claims.
3. Make the narrowest correction that resolves the request: `UPDATE` only the columns that change. When changing the profile text, update `description` and regenerate `body` from it together.
4. Invalidate the cache and re-read the API to confirm the change.

## Guardrails

- Tone: informative, technical and objective.
- Do not invent metadata, URLs, capabilities, relationships or asset provenance.
- Keep changes scoped to the requested technology; no broad rewrites or unrelated rows.
- Never write `content/**` files; the website no longer reads them.
- Report what was verified, changed (rows, R2 keys), invalidated and left unresolved.
