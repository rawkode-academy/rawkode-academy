# CMS content import

The website reads public editorial content from Payload at request time through the `PAYLOAD_CONTENT` service binding. Astro no longer registers local content collections, and the website does not synchronize content from the public GraphQL API.

The monorepo content files remain the migration/import source. Payload's static importer reads their authored frontmatter, Markdown/MDX bodies, and referenced assets into the CMS. The public bridge exposes only approved fields, preserves existing slugs, and keeps video object IDs for media delivery.

## Current workflow

- Edit and schedule public content in Payload.
- Use the Payload import/reconcile scripts when loading or reconciling the monorepo's existing content corpus.
- Website preview and production Workers read content through `PAYLOAD_CONTENT`; no website content sync command or build-time collection generation is required.
- The website's safe CMS body renderer supports its finite component registry, code blocks, approved embeds, CMS media URLs, and Payload-pre-rendered D2 SVGs.

The files under `content/` remain available for import and rollback. Runtime website output does not read them.

## Request caching and scheduled releases

Astro renders public pages on every cache miss and reads Payload through its internal service binding. The request gateway sends anonymous public SSR requests through a separate Cloudflare Workers Cache entrypoint in the isolated PR preview; it screens cookies, credentials, Access identity, and private routes before cache lookup. Checksum-addressed CMS images and D2 SVG routes can use that entrypoint too. Static build assets bypass it. Production keeps this native entrypoint cache disabled until the preview's freshness, isolation, and cost results are reviewed.

Mutable SSR responses have a maximum 30-second lifetime, clipped to the next `publishedAt` boundary, and carry `must-revalidate`. The preview asserts native `CF-Cache-Status` hits and repeats a warmed archive request at the scheduled release boundary. The cache entrypoint key gets the request host as trusted Worker props; preview Worker versions are isolated by deployment. Cookies, credentials, Access identity, private routes, interactive APIs, conditional/range requests, and rewrite headers stay on the uncached gateway. The gateway uses no Cache API response cache for HTML while native preview caching is enabled. The Payload bridge retains its independent short-lived read cache.

The Cloudflare Images binding creates WebP variants and successful variants use checksum- and width-addressed URLs. A transform failure or missing Images binding returns the original raster uncached. D2 source is rendered at import or editorial save time; the website serves the checksum-verified SVG artifact from R2 and does not render diagrams during page requests. Cloudflare consumes `Cloudflare-CDN-Cache-Control` at the edge, so the preview checks the client-visible cache policy and verifies actual cache freshness at the scheduled release boundary.
