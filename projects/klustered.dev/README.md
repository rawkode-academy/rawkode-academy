# klustered.dev

Admin + competitor portal for the Klustered game show. Lives at `https://klustered.dev`.

## Stack

- Deno 2 + Astro 5
- Tailwind v4
- Cloudflare D1 (separate instance from `rawkode.academy`)
- Shared Better Auth deployment with `rawkode.academy`
- Cloudflare Workers (static `dist/` for now; SSR added when auth lands)

## Development

```sh
cuenv task dev    # or: deno task dev
cuenv task build  # or: deno task build
cuenv task check  # or: deno task check
```

The companion public site lives at `../klustered.live/`.
