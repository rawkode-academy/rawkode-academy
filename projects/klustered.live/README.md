# klustered.live

Public website for the Klustered game show. Lives at `https://klustered.live`.

## Stack

- Bun + Astro 5 (matches `projects/rawkode.academy/website`)
- Tailwind v4 (game-show theme — distinct from `rawkode-blue`)
- Cloudflare Workers (SSR via `@astrojs/cloudflare`)
- People + videos sourced from the monorepo `content/` collections

## Development

```sh
cuenv task dev      # or: bun run dev
cuenv task build    # or: bun run build
cuenv task check    # or: bun run check
```

The companion admin + competitor portal lives at `../klustered.dev/`.
