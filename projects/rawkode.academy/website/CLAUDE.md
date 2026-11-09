# Rawkode Academy Website - Development Guide

## Quick Start

```bash
cuenv task dev        # Start Astro dev server (preferred)
cuenv task build      # Type check + build
bun run test          # Run vitest
bun run test:watch    # Watch mode
bun run format        # Biome format
bun run storybook     # Component development
```

## Design system

`DESIGN.md` is the design direction and `PRODUCT.md` is the audience and voice.
Read both before changing anything visual. The implementation source of truth
is `../../../packages/design-system` (Panda CSS v2 tokens and recipes, Ark UI
behaviour, Vue components).

### Foundations

- **Type:** Red Hat Display (titles), Red Hat Text (reading, navigation,
  forms), Red Hat Mono (identifiers and metadata). Loaded through Astro's font
  integration as `--font-red-hat-display`, `--font-red-hat-text`,
  `--font-red-hat-mono`; recipes use the `academy-display`, `academy-text` and
  `academy-mono` font tokens.
- **Colour:** semantic `academy.*` tokens only (`academy.canvas`,
  `academy.text`, `academy.accent`, `academy.ink*`, `academy.status*`). They
  resolve per colour scheme. Never copy a hex value into a component.
- **Surfaces:** flat, 3 to 6px radii, hairline borders. Shadows are for
  floating layers (dialogs). Ink surfaces open and close every page.
- **Motion:** `fast` / `base` / `slow` / `reveal` durations with
  `academy-out` easing. Every animation has a reduced-motion alternative.

### Where styles live

1. **Shared primitives** come from the package. Use these before writing
   anything new:
   - `button()` / `<Button>`: every action. Variants `solid`, `outline`,
     `ink`, `quiet`; sizes `sm`, `md`, `lg`; `fullWidth`; `icon`.
   - `focusRing`, `focusRingInset`, `focusRingInk`: compose under
     `_focusVisible`. Do not hand-write an outline.
   - `systemGridTop`, `systemGridBottom`: the grid motif, on ink surfaces only.
   - `Dialog`, `Tabs`, `NavigationDrawer`: Ark-backed Vue components.
   - `academyLabel`, `academyContainer`, `academySkeleton`, `academyCallout`.
2. **Page recipes** (`academyPage`, `academyWatch`, `academyCatalog`, ...)
   hold the layout of one surface. They compose the shared fragments above
   and must not redefine a button, focus ring or grid.
3. **Website CSS** is `src/styles/global.css` (reset, prose, compatibility
   aliases) plus styles scoped to a component. There is no utility-CSS
   compiler: a Tailwind-style class such as `flex` or `px-4` has no CSS behind
   it and renders unstyled.

```astro
---
import { academyLayout, button } from "@rawkodeacademy/design-system";
const s = academyLayout({ width: "wide" });
---
<a class={button()} href="/watch">
  Watch the latest session <span data-part="arrow" aria-hidden="true">→</span>
</a>
<a class={button({ variant: "outline" })} href="/read">Read articles</a>
```

### Rules

- A view has at most one `solid` button. It is the accent, and the accent is
  the next thing to do.
- Panda extracts styles statically. Shared fragments must be plain object
  literals: a function that builds styles returns class names with no CSS.
  `src/tests/design-system-coverage.test.ts` fails when that happens.
- After changing a recipe or token run
  `bun run --cwd ../../../packages/design-system check`.
- `--editorial-*`, `--brand-*` and `--surface-*` variables in `global.css`
  are compatibility aliases onto `academy.*` tokens, kept for older surfaces.
  Do not use them in new code; migrate a consumer when you touch it.
- No uppercase tracked eyebrows, gradient text, glass blur, side-stripe
  borders or decorative metadata. See `DESIGN.md`.
- Review in Storybook (`Design System/*`) in both colour schemes before
  shipping a primitive.

### Navigation

The site uses normal document navigation, not Astro's `ClientRouter`, so
per-page `<script>` blocks need no `astro:page-load` wiring. Do not add a
page-wide crossfade.

## Light / Dark / System mode

Two concepts:

- **Preference** (`ColorSchemePreference`) — stored user choice: `"light"` | `"dark"` | `"system"`.
- **Applied scheme** (`ColorScheme`) — resolved value on the page: `"light"` | `"dark"`.

```typescript
import {
  getColorScheme,           // applied — "light" | "dark"
  getColorSchemePreference, // stored — "light" | "dark" | "system"
  setColorScheme,           // takes preference, persists + applies
  toggleColorScheme,        // cycles light → dark → system → light
} from "@/lib/theme";
```

`window.addEventListener("color-scheme-change", e => { e.detail.preference; e.detail.scheme })` fires on user toggle and on OS theme change when preference is `"system"`. `ThemeScript.astro` sits in `<head>` and applies the persisted scheme before paint.

`<ThemeToggle />` drops the cycling icon toggle anywhere.

## Development Workflow

1. Look in `@rawkodeacademy/design-system` before building a new primitive.
2. Use Storybook to develop in isolation.
3. `astro check` runs as part of `bun run build`. The vitest suite is run separately via `bun run test`.
4. Biome formats: `bun run format`. Tabs, double quotes.
5. Test both light and dark schemes manually before shipping.
6. Be responsive and accessible: WCAG AA contrast, keyboard access, visible focus.

## Project-Specific Conventions

- Commit format: `feat(rawkode.academy/website): description`. See root CLAUDE.md for the full type list.
- Indentation: tabs. YAML: spaces.
- Astro: prop bindings to Vue components use plain `prop={value}` syntax, **not** Vue's `:prop=` (Astro errors on the colon-prefixed form).
- React `client:only="react"` should be reserved for genuinely interactive surfaces. SEO falls off otherwise.
- Long-form prose flows through the `academyDocument` recipe and the prose rules in `global.css`.

## Show Extensions & Plugins

Shows (`/shows/[showId]`) can expose extra pages and endpoints via a generic
plugin system. A show feature is built **once as a reusable plugin** (e.g.
Bracket, and later Quiz/Poll) and each show is just an instance with config.

**Host** (`src/lib/shows/`):
- `types.ts` — `ShowExtension` (`pages`, `endpoints`), `ShowPageModule`
  (`slug`, `label`, `load(ctx)`, `Component`, `meta`, `cache`), `ShowPlugin`
  (a `(config) => ShowExtension` factory).
- `registry.ts` — maps `showId -> ShowExtension`; `getShowExtension`,
  `getShowNav`, `hasExtension`.
- `client.ts` — `queryShowsApi` helper for federated GraphQL reads.
- Routing: `src/pages/shows/[showId]/[...slug].astro` (pages) and
  `src/pages/api/shows/[showId]/[...slug].ts` (endpoints) dispatch from the
  registry into `ShowLayout` + `ShowNav`. The hub `[showId].astro` renders the
  nav when `hasExtension(showId)`.

`load(ctx)` runs server-side before the layout (so it resolves data **and**
title); `Component` receives the data as props.

**Writing a plugin:** export a `ShowPlugin<Config>` factory under
`src/lib/shows/plugins/<name>/` returning `{ showId, pages, endpoints }`. Reads
go through `queryShowsApi` to the federated API; writes go through a platform
service's write-model bound on the worker (see Bracket).

**Bracket plugin** (`src/lib/shows/plugins/bracket/`): reads bracket data from
the federated `Show` entity (served by the `platform/brackets` CQRS service),
writes registrations via the `BRACKETS_WRITE` service binding. Klustered is the
first instance: `src/shows/klustered/index.ts` = `bracketPlugin({ showId: "klustered" })`.

## Resources

- Design direction: `DESIGN.md`; product and voice: `PRODUCT.md`
- Design system: `../../../packages/design-system` (`panda.config.ts`, `src/recipes`, `src/styles`, `src/vue`)
- Theme utilities: `src/lib/theme.ts`
- Global styles: `src/styles/global.css`
- Storybook: `bun run storybook`
