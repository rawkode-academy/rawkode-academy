# klustered.live

Public website for the Klustered game show. Lives at `https://klustered.live`.

## Stack

- Deno 2 + Astro 5
- Tailwind v4 (game-show theme — distinct from `rawkode-blue`)
- Cloudflare Workers (static `dist/`)
- People + videos sourced from the monorepo `content/` collections

## Development

```sh
cuenv task dev    # or: deno task dev
cuenv task build  # or: deno task build
cuenv task check  # or: deno task check
```

The companion admin + competitor portal lives at `../klustered.dev/`.
