# klustered.dev

Admin + competitor portal for the Klustered game show. Lives at `https://klustered.dev`.

## Stack

- Bun + Astro 6 (matches `projects/rawkode.academy/website`)
- UnoCSS (`preset-wind3`)
- Cloudflare Workers (SSR via `@astrojs/cloudflare`)
- Reads the `platform-brackets` D1 (owned by `platform/brackets`) via `env.BRACKETS`;
  all writes go through the brackets write-model over the `BRACKETS_WRITE` service binding
- Auth via id.rawkode.academy (OIDC client `klustered-dev`); sessions in the `SESSION` KV

This portal owns no database of its own. The bracket domain belongs to the
`platform/brackets` service, and auth is delegated to id.rawkode.academy.

## Authorization

Admins are an explicit allowlist of id.rawkode.academy user ids (OIDC subs), set
via the `KLUSTERED_ADMIN_IDS` var in `wrangler.jsonc`. Any other authenticated
user is a competitor and can manage their own details under `/me`.

## Development

```sh
cuenv task dev       # or: bun run dev
cuenv task build     # or: bun run build
cuenv task check     # or: bun run check
```
