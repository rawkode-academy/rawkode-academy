# content-cdn

Minimal Cloudflare Worker that proxies the `rawkode-academy-content` R2 bucket
behind `content.rawkode.academy` and:

- serves `/robots.txt` with `Disallow: /` so crawlers stop discovering
  caption/stream/thumbnail URLs as pages
- sets `X-Robots-Tag: noindex` on every R2 response so anything Google already
  crawled drops out of the index on re-fetch

This exists because Cloudflare's R2 public-domain feature serves bucket objects
directly with no place to set custom response headers. Without this worker,
Googlebot was treating thousands of `.vtt` caption files and `.m3u8` stream
manifests as pages, where they piled up under
"Crawled — currently not indexed" in Google Search Console.

## Deployment

```bash
cd projects/rawkode.academy/platform/content-cdn
bun install
bun run deploy
```

After first deploy, in the Cloudflare dashboard:

1. Remove the custom domain mapping from the R2 bucket
   (`R2 > rawkode-academy-content > Settings > Custom Domains`).
2. Verify the route `content.rawkode.academy/*` is bound to this worker
   (already declared in `wrangler.jsonc`).

The R2 bucket itself stays private and is reached only via the
`CONTENT_BUCKET` binding.
