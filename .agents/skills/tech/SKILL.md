---
name: tech
description: "Research, validate, and set up technology profiles in Rawkode Academy content/technologies. Use when adding a technology, checking an existing technology profile, or updating its metadata and content."
---

# Rawkode Academy Technology Profiles

Maintain accurate, focused profiles in `content/technologies`.

## Before Authoring

1. Check whether `content/technologies/<kebab-case-slug>/index.mdx` exists.
2. Read `content/src/technologies.ts` and `content/src/dimensions.ts` as the current schema authority, then read nearby technology profiles for local frontmatter and prose conventions.
3. Research only from primary project sources: official site, documentation, source repository, and official licensing information.

The live schema currently requires `name` and `website`; `license` and `status` default when omitted. Add optional fields only when verified and useful: `seo`, `logos`, `source`, `documentation`, `category`, `subcategory`, `aliases`, `relatedTechnologies`, `terms`, `cncf`, `community`, `useCases`, `features`, `learningResources`, and `matrix`.

## Profile Rules

- `logos` records existing local assets with booleans only: `icon`, `horizontal`, and `stacked` declare whether `icon.svg`, `horizontal.svg`, and `stacked.svg` exist. It is optional; never invent, download without provenance, or create placeholder assets.
- Use one optional singular `category` and one optional singular `subcategory`; do not use `categories`.
- Use lifecycle `status` only from: `alpha`, `beta`, `stable`, `preview`, `superseded`, `deprecated`, or `abandoned`.
- If adding `matrix`, its required `status` is one of `skip`, `watch`, `explore`, `learn`, `adopt`, `advocate`, `graveyard`, or `guilty-pleasure`. Its optional `grouping`, `confidence`, and `trajectory` respectively use `plumbing`/`platform`/`observability`/`security`, `gut`/`some-experience`/`deep-experience`, and `rising`/`stable`/`falling`.
- Do not add obsolete frontmatter such as top-level `description`, `categories`, or a `radar` block.

## Create or Update

For a new profile, create only the needed directory, `index.mdx`, and verified logo files. Write concise, objective MDX grounded in the sources. For an existing profile, first verify its metadata, terminology, links, and claims, then make the narrowest correction that resolves the request. Preserve useful existing content and established nearby style.

## Guardrails

- Prefer primary sources and distinguish verified facts from uncertain claims.
- Do not invent metadata, URLs, capabilities, relationships, or asset provenance.
- Keep changes scoped to the requested technology; avoid broad rewrites and unrelated files.
- Report what was verified, changed, and left unresolved.
