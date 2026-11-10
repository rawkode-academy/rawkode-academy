# Rawkode Academy Website - Development Guide

## Quick Start

```bash
cuenv task dev        # Start Astro dev server (preferred)
cuenv task build      # Type check + build
bun run test          # Run vitest
bun run test:watch    # Watch mode
bun run format        # Biome format
bun run storybook     # Component development
bun run test:visual   # Storybook axe + screenshot checks
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
- **Surfaces:** flat, 3 to 6px radii, hairline borders; tags and chips are
  the one pill (`pill`, `academy-pill`). Shadows are for floating layers
  (dialogs), which dim the page with `academy.scrim`. Ink surfaces open and
  close every page.
- **Motion:** `fast` / `base` / `slow` / `reveal` durations with
  `academy-out` easing. Every animation has a reduced-motion alternative.

### Where styles live

1. **Shared primitives** come from the package. Use these before writing
   anything new:
   - `button()` / `<Button>`: every action. Variants `solid`, `outline`,
     `quiet`; `surface: "ink"` on ink surfaces; sizes `sm`, `md`, `lg`;
     `fullWidth`; `icon`.
   - `focusRing`, `focusRingInset`, `focusRingInk`: compose under
     `_focusVisible`. Do not hand-write an outline.
   - `systemGridTop`, `systemGridBottom`: the grid motif, on ink surfaces only.
   - `scrollReveal`: the scroll-driven entrance for list rows and cards.
     Content stays visible in print and without scroll timelines.
   - `inkSurface`, `inkStage`: the ink surface that opens a page (hero,
     masthead, Search, video stage). The slot adds its own padding.
   - `ledgerRow` and the other `ledger*` fragments, `ruledList`: the row
     shared by Read and News (`academyCatalog.editorial*`). Markup contract
     in `src/styles/ledger.ts`. The homepage sets a compact three-column
     form of the row in its own slots (`academyPage.columns`, `entry*`).
   - `videoFrame`, `coverImage`, `coverImageZoom`, `runtimeBadge`: the 16:9
     still, the image that fills it and the runtime set over it.
   - `panelSurface`, `linkedPanel`, `pill`: framed panels and the tag outline.
   - `textLink`: the standalone text link ("All videos →", a project link).
     A link inside a sentence stays underlined in the accent.
   - `VideoCard.astro` (`academyPage.card`): the one video card, also behind
     `video-feed.astro` (its `progress` slot takes a watch-progress bar) and,
     with `scheduled`, an upcoming stream. The homepage (`AcademyPage.vue`) sets
     the next stream as an ink band instead (`academyPage.band*`). `localDate` (`17 Jul 2026`) and `formatRuntime`
     (`1h 2m`) are the one date and runtime form; `Breadcrumb.astro` is the
     one breadcrumb.
   - `inputField`: a text input's surface and its placeholder, invalid,
     disabled and focus states. The slot sets height, padding and font size.
   - `mastheadTitle`, `posterTitle`, `ledeText`, `sectionTitle`, `headingLg`,
     `headingMd`, `cardTitle`, `monoMeta`, `kicker`: shared type steps.
   - `Dialog`, `Tabs`, `NavigationDrawer`: Ark-backed Vue components.
   - `academyLabel`, `academyContainer`, `academySkeleton`, `academyCallout`.
2. **Page recipes** (`academyPage`, `academyWatch`, `academyCatalog`, ...)
   hold the layout of one surface. They compose the shared fragments above
   and must not redefine a button, focus ring, grid, ink surface, ledger
   row, still, panel, input or type step. Fragments are style objects, not
   classes: a page or component uses them through a recipe slot.
3. **Website CSS** is `src/styles/global.css` (reset, base type ramp, list
   markers for rendered rich text, the `sr-only` helper and the
   `--terminal-*` code-block tokens) plus styles scoped to a component. A
   scoped style reads the variables Panda generates from the tokens:
   `var(--colors-academy-text)`, `var(--colors-academy-border)`,
   `var(--fonts-academy-mono)`, `var(--radii-academy-s)`,
   `var(--durations-base)`, `var(--easings-academy-standard)`. There is no
   utility-CSS compiler: a Tailwind-style class such as `flex` or `px-4` has
   no CSS behind it and renders unstyled.

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
- A spread is shallow. A slot that spreads a fragment and then declares its
  own `_hover` or `_lg` replaces the fragment's block; override with flat
  keys or restate the block.
- After changing a recipe or token run
  `bun run --cwd ../../../packages/design-system check`.
- The old alias layer is retired. Do not use `--editorial-*`, `--brand-*`,
  `--surface-*`, `--text-*-content`, `--text-muted`, `--radius-*`,
  `--duration-*`, `--ease-*` or `--font-instrument-serif` /
  `--font-inter-tight` / `--font-jetbrains-mono`, nor the classes that went
  with them (`paper-card`, `hairline-chip`, `focus-ring`, `text-muted`,
  `text-primary-content`, `bg-primary`). Use a recipe slot, `button()`, or
  the Panda variable for the matching `academy.*` token.
  `scripts/check-academy-shell.mjs` bans these names in the watch sources.
- In a scoped style the focus ring is
  `outline: 2px solid var(--colors-academy-accent); outline-offset: 2px`
  under `:focus-visible`, the same values as `focusRing`.
- No uppercase tracked eyebrows, gradient text, glass blur, side-stripe
  borders or decorative metadata. See `DESIGN.md`.
- Review in Storybook (`Design System/*`) in both colour schemes before
  shipping a primitive.
- After a recipe, token or story change run `bun run test:visual`. It builds
  Storybook, runs axe on every story in light and dark, and compares the
  stories tagged `visual` with `visual/__screenshots__/`. It needs no network.
  This check is manual: no CI workflow runs it yet, so a change that skips
  it can merge with a failing story or a stale baseline.
- For an intended visual change run `bun run test:visual:update`, review the
  changed PNGs and commit them. Baselines are Linux-only; see
  `.storybook/README.md`.
- `src/tests/design-tokens.test.ts` fails on a raw colour (hex, `rgb()`,
  `oklch()`) anywhere in `src` outside its allowlist and counted baseline, a
  `var(--name)` that nothing defines (which is what a retired alias is), and
  a class name that no rule reaches. A scoped style only counts inside its
  own file; HTML built as a string needs a global rule. A class held in a
  variable (`const cls = "..."`) is not read, so keep class names in the
  template.

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
- Long-form prose is styled by the `prose` slot of `academyLayout` (and `academyDocument` for document pages). `global.css` only restores list markers for `[data-academy-prose]` and `[data-academy-learn-list]`; no markup carries a literal `prose` class.

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
