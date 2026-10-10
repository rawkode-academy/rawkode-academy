# CMS content import

The website reads public editorial content from Payload at request time through the `PAYLOAD_CONTENT` service binding. Astro no longer registers local content collections, and the website does not synchronize content from the public GraphQL API.

The monorepo content files remain the migration/import source. Payload's static importer reads their authored frontmatter, Markdown/MDX bodies, and referenced assets into the CMS. The public bridge exposes only approved fields, preserves existing slugs, and keeps video object IDs for media delivery.

## Current workflow

- Edit and schedule public content in Payload.
- Use the Payload import/reconcile scripts when loading or reconciling the monorepo's existing content corpus.
- Website preview and production Workers read content through `PAYLOAD_CONTENT`; no website content sync command or build-time collection generation is required.
- The website's safe CMS body renderer supports its finite component registry, code blocks, approved embeds, CMS media URLs, and Payload-pre-rendered D2 SVGs.

The files under `content/` remain available for import and rollback. Runtime website output does not read them.
