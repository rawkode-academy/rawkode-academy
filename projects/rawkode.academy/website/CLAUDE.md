# Rawkode Academy Website - Development Guide

## Quick Start

```bash
cuenv task dev        # Start Astro dev server (preferred)
cuenv task build      # Type check + build
bun run test          # Run vitest
bun run test:watch    # Watch mode
bun run format        # Biome format
bun run storybook     # Component development
bun run codegen       # GraphQL codegen
bun run sync:content  # Sync GraphQL content
```

## Component Library & Design System

### Theme: Modern technical publication

The website ships a single design system: warm paper surfaces, deep ink type, a scarce serif display voice, compact sans hierarchy, and mono metadata. Light and dark colour schemes share the same vocabulary — values invert, names do not. A compact publication masthead replaces the former persistent sidebar so reading, video, and comparison pages retain the full canvas.

#### Atomic CSS engine

UnoCSS (via `@unocss/astro` + `@unocss/vite` for Storybook). Configuration lives in `uno.config.ts` at the project root: theme tokens, shortcuts, rules, transformers (`directives`, `variant-group`). `@apply`, `theme()`, `@screen` directives all work in scoped Astro/Vue `<style>` blocks via `@unocss/transformer-directives`.

There is **no `tailwind.config.ts`**. There is **no `@tailwindcss/vite` plugin**. If you are reaching for either, stop — extend `uno.config.ts` instead.

#### Palette

- **Paper** `oklch(0.97 0.008 85)` — light surface
- **Paper-deep** `oklch(0.93 0.012 85)` — secondary light surface (card backgrounds, video frames)
- **Ink** `oklch(0.18 0.02 60)` — primary text on light
- **Ink-soft** `oklch(0.36 0.015 60)` — body text on light
- **Ink-mute** `oklch(0.58 0.012 60)` — tertiary / meta on light
- **Hairline** `oklch(0.18 0.02 60 / 0.12)` — default 1px border
- **Hairline-strong** `oklch(0.18 0.02 60 / 0.22)` — emphasis border
- **Spruce** `oklch(0.52 0.09 165)` — primary accent (links, section marks, command-bar caret)
- **Amber** `oklch(0.72 0.15 65)` — "live" / on-air / breaking
- **Rust** `oklch(0.55 0.13 40)` — secondary accent (difficulty tags, kickers)
- **Violet** `oklch(0.50 0.13 290)` — third accent (reserved for variant work)

Supporting surface tokens:

- `--surface-skeleton` — bone colour for the `Skeleton*` loading family; flips with the scheme.
- `--terminal-bg` / `--terminal-surface` / `--terminal-border` / `--terminal-text` / `--terminal-text-dim` — theme-invariant chrome for terminals, WebContainers, and other "screen within the page" surfaces. These stay dark in light mode; never swap them for `--surface-*`.

Dark mode replaces paper with `oklch(0.14 0.01 280)` (ink-dark), surface-card with `oklch(0.26 0.014 280)` (paper-dark), and the ink/hairline triplet flips to whites at varying opacity. The token *names* survive: `--surface-card`, `--editorial-ink`, etc. consume the active mode automatically.

#### Token surfaces

Every editorial value is exposed two ways:

1. **Direct oklch CSS variable** — preferred for new code. `--editorial-paper`, `--editorial-paper-deep`, `--editorial-ink`, `--editorial-ink-soft`, `--editorial-ink-mute`, `--editorial-hairline`, `--editorial-hairline-strong`, `--editorial-spruce`, `--editorial-amber`, `--editorial-rust`, `--editorial-violet`.
2. **Legacy RGB triplet** — kept for the `rgb(var(--brand-primary) / 0.x)` and `rgba(var(--brand-primary), 0.x)` patterns left over from Rawkode Blue. Values now resolve to editorial colours: `--brand-primary` = spruce, `--brand-secondary` = amber, `--brand-accent` = rust.

UnoCSS theme keys mirror the direct palette as classes:

| Class | Resolves to |
|-------|-------------|
| `text-primary` / `bg-primary` | spruce |
| `text-secondary` / `bg-secondary` | amber |
| `text-accent` / `bg-accent` | rust |
| `text-primary-content` | `--editorial-ink` (light) / `--editorial-ink` (dark, flipped) |
| `text-secondary-content` | `--editorial-ink-soft` |
| `text-muted` | `--editorial-ink-mute` |

#### Typography

The trio:

- **Display** — `Instrument Serif`, italic by default for h1/h2 and headline-scale text. Negative letter-spacing on display sizes pulls the line tight. CSS variable `--font-instrument-serif` (loaded via Astro's font integration).
- **Body** — `Inter Tight`, weight 300–700. CSS variable `--font-inter-tight`.
- **Mono** — `JetBrains Mono`, weights 400–600. CSS variable `--font-jetbrains-mono`. Used for `MLabel`, `KickerStrip`, code blocks, meta strips, keycaps, runtime overlays.

The `@layer base` heading ramp in `global.css` sets `h1`/`h2` to Instrument Serif italic and `h3`/`h4` to Inter Tight medium with tight tracking. Component-level utility classes still override these by specificity.

UnoCSS theme keys: `font-display` (= Instrument Serif), `font-body` / `font-sans` (= Inter Tight), `font-mono` (= JetBrains Mono), `font-serif` (= Instrument Serif).

#### Radii

Collapsed and sharp. Editorial design uses 2–8px corners, not pillowy 1rem+.

| Token | Class | Value |
|-------|-------|-------|
| `--radius-xs` | `rounded-xs` | 2px |
| `--radius-sm` | `rounded-sm` | 2px |
| `--radius-md` | `rounded-md` | 3px |
| `--radius-lg` | `rounded-lg` | 3px |
| `--radius-xl` | `rounded-xl` | 4px |
| `--radius-2xl` | `rounded-2xl` | 4px |
| `--radius-3xl` | `rounded-3xl` | 6px |
| `--radius-4xl` | `rounded-4xl` | 8px |
| `--radius-pill` | `rounded-full` | 9999px (chips only) |

#### Shadow / depth

Editorial doesn't use drop shadows — it uses hairline borders. The `--shadow-*` ramp resolves to a single 1px ink ring at increasing opacity:

| Token | Value |
|-------|-------|
| `--shadow-sm` | `0 0 0 1px oklch(0.18 0.02 60 / 0.06)` |
| `--shadow-md` | `0 0 0 1px oklch(0.18 0.02 60 / 0.10)` |
| `--shadow-lg` | `0 0 0 1px oklch(0.18 0.02 60 / 0.16)` |
| `--shadow-xl` | `0 0 0 1px oklch(0.18 0.02 60 / 0.20)` |

Dark mode flips to white-at-low-opacity. The `card-shadow-{sm,md,lg,xl}` shortcuts in `uno.config.ts` resolve to these tokens.

#### Motion

| Token | Value | Use |
|-------|-------|-----|
| `--duration-fast` | 120ms | micro-interactions |
| `--duration-base` | 200ms | default transitions |
| `--duration-slow` | 300ms | layout shifts |
| `--duration-slower` | 500ms | page-level moves |
| `--ease-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | default |
| `--ease-out` | deceleration | enter |
| `--ease-in` | acceleration | exit |
| `--ease-spring` | gentle overshoot | rare |

Pre-built: `transition-fast`, `transition-smooth` (= base), `transition-card` (= slow), `transition-spring`. Property-specific colour variants: `transition-colors-smooth`, `transition-colors-card`.

#### Focus ring

Add `class="focus-ring"`. Renders a 2px outline in `--brand-primary` (spruce) at `:focus-visible` only, so mouse clicks don't trigger it.

#### Headings (recap)

| Tag | Family | Style | Weight | Size |
|-----|--------|-------|--------|------|
| h1 | Instrument Serif | italic | 400 | 4xl → 5xl |
| h2 | Instrument Serif | italic | 400 | 3xl → 4xl |
| h3 | Inter Tight | normal | 500 | xl → 2xl |
| h4 | Inter Tight | normal | 500 | lg → xl |

Negative letter-spacing tightens display sizes (`-0.035em` on h1, `-0.025em` on h2).

#### Components

##### Editorial primitives (`src/components/ui/`)

| Component | Use |
|-----------|-----|
| `MLabel.vue` | Mono uppercase label, 11px, 0.14em tracking. Tones: `muted`, `soft`, `ink`, `accent`, `amber`, `rust`, `spruce`. |
| `LiveDot.vue` | 7px pulsing dot with halo ring. `color` prop: `amber` (default), `spruce`, `rust`, `ink`. Respects `prefers-reduced-motion`. |
| `SectionMark.vue` | `§NN · Label`. Numbers zero-pad to two digits. Optional leading dot. |
| `KickerStrip.vue` | Full-width hairline-bordered band with `LiveDot` + meta text + flex divider + right meta. Variant: `heavy` (2px ink top border). |
| `CommandBar.vue` | Editorial header: ink-square sigil + wordmark, command pill with `⌘K`, secondary nav, "Sign in" CTA. Dispatches `open-command-palette` CustomEvent. |
| `MastheadBar.vue` | Newspaper-style heavy-border strip with left/right MLabels and an optional centered serif italic quote. |
| `EditorialButton.vue` | `variant`: `solid` (ink on paper), `outline` (hairline border), `ghost`. `size`: `sm/md/lg`. `arrow` prop adds a trailing `→`. Renders `<a>` if `href` is set, `<button>` otherwise. |
| `StatRow.vue` | N-column band with serif italic numerals and `MLabel` captions. Hairline column dividers. |
| `SectionRail.vue` | Anchor rail (e.g. `§01..§06`). Hairline-bordered grid; each cell hovers to `--surface-card-muted`. |
| `HairlinePanel.vue` | Paper / paper-deep / muted / ink surface with 1px hairline. Optional `heavy` variant uses 2px ink border. |
| `EmptyState.vue` | "Loaded, but nothing here" counterpart to the `Skeleton*` family. Serif italic `title`, optional `body`, mono uppercase links via the `actions` slot, `align`: `center`/`start`. Use it for zero-result search, filtered-out lists, empty comments. |
| `PagerStrip.astro` | Editorial pager: prev/next links around a mono `Page N [of M]` label. Server-rendered `?page=N` links; used by `/watch` and `/read`. |

Every editorial primitive has a `*.stories.tsx` under the same folder. Run `bun run storybook` to explore.

##### Shared primitives (refactored, not new)

- `Card.vue` — default variant is now `paper` (alias: `glass`). Hover thickens the top edge to a 2px ink line instead of scaling. Variants: `paper`, `paper-muted`, `editorial` (no background, top hairline only — used in news rails), `solid`, `bordered`, `flat`. The `gradient` variant is kept as an alias of `paper-muted`.
- `Hero.vue` — keeps its `centered` / `split` / `full-width` layouts. For the landing-page Variant A composition, use `src/components/landing/LandingHero.astro` (which assembles primitives directly).
- `BaseCard.vue` — the spine of `ArticleCard.astro` and `CourseCard.astro`. Top hairline thickens on hover; cover frame is a 16:10 paper-deep block.
- `ThemeToggle.vue` — unchanged plumbing (`getColorScheme`, `setColorScheme`, `color-scheme-change` event in `src/lib/theme.ts`). The visual treatment lives in the component itself.

##### Landing components (`src/components/landing/`)

Composition components consumed only by `src/pages/index.astro`:

- `LandingHero.astro` — Variant A: serif italic h1 over sans h2/h2-soft, kicker, lede, two CTAs, `StatRow`, `OnAirPanel` right column.
- `OnAirPanel.astro` — live session frame: terminal placeholder + REC overlay + "Next up" schedule.
- `NewsletterStrip.astro` — single-line hairline band.
- `SectionHeader.astro` — `§NN · kicker / Serif italic title / Body / optional CTA`.
- `EditorialCardRail.astro` — 4-column hairline grid, no images.
- `FeaturedFeature.astro` — large feature: serif title left, 16:10 media right, mono meta, CTA. Handles `mediaImage` (Astro `<Image>`), `mediaSrc` (raw URL), or `mediaPlaceholder`.
- `SecondaryGrid.astro` — 3-column hairline grid with optional 16:10 media.
- `ValuesGrid.astro` — 3×2 hairline grid with `§0N` SectionMarks.

##### Editorialised content cards

- `src/components/articles/ArticleCard.astro` — mono category · date · reading time meta strip, serif italic title, AuthorAvatarGroup footer.
- `src/components/courses/CourseCard.astro` — rust-toned difficulty + module count, serif italic title, learning-path list, ink-on-paper masthead for coverless courses.
- `src/components/video/video-feed.astro` — paper-deep 16:9 thumbnails with mono `MM:SS` runtime overlay and serif italic titles. Used on `/watch`.

#### Legacy class aliases

The following class names from the Rawkode Blue era still work — they're aliased to editorial surfaces in `global.css`:

| Legacy class | Now resolves to |
|--------------|-----------------|
| `.glass-panel`, `.glass-card`, `.glass-card-shimmer` | paper card (`--surface-card` + hairline + small radius) |
| `.glass-interactive` | flat paper with hairline; hover swaps to `--surface-card-muted` |
| `.glass-chip` | hairline pill, mono uppercase |
| `.section-shell`, `.section-shell-muted`, `.soft-panel` | paper / muted paper with hairline |
| `.btn-glass` | mono uppercase outline button (hairline border) |
| `.btn-solid` | mono uppercase ink button on paper |
| `.bg-gradient-hero`, `.bg-gradient-hero-alt` | flat `var(--surface-base)` |
| `.bg-gradient-primary` | flat ink on paper |
| `.bg-gradient-secondary` | flat spruce on paper |
| `.bg-gradient-card` | flat `var(--surface-card)` |
| `.border-glass`, `.border-glass-subtle` | hairline |
| `.border-glass-strong` | hairline-strong |

**Prefer the editorial primitives in new code.** The aliases exist so the 35-ish existing consumers don't all need to be touched at once; migrate them as you work on their owning routes.

#### Anti-patterns

- Don't `backdrop-blur-*`. Editorial doesn't blur.
- Don't `from-primary` / `to-secondary` linear-gradient washes. Use flat surfaces.
- Don't add box-shadows for elevation. Use hairline borders.
- Don't `rounded-2xl` and above for cards. Editorial is sharp.
- Don't hardcode hex values. Reach for `--editorial-*` or the semantic `text-*` / `bg-*` classes.
- Don't use raw `gray-*` colour utilities (`bg-gray-800`, `text-gray-500`, `dark:bg-gray-900`, …). They're blocked in `uno.config.ts` (no CSS is generated) and `src/tests/design-tokens.test.ts` fails CI with the offending file:line. Use `text-primary-content` / `text-secondary-content` / `text-muted`, `bg-[var(--surface-*)]`, `border-[var(--surface-border)]`, or the `--terminal-*` tokens.
- Don't write `rgb(95 94 215 / 0.x)` (the old Rawkode Blue purple). The triplet is now spruce; you almost always want `var(--editorial-spruce)` instead.
- Don't reach for `react-type-animation` or other type-on effects. The editorial system is static.

#### View transitions

The site uses **native cross-document view transitions** (`@view-transition { navigation: auto }` in `global.css`), not Astro's `ClientRouter`. Full page loads still happen, so per-page `<script>` blocks need no `astro:page-load` wiring. Conventions:

- Persistent chrome (topbar, sidebar) carries a fixed `view-transition-name` so it reads as static during navigation.
- Matching elements across two pages morph by sharing a name: use `videoTransitionName(slug)` from `src/utils/view-transition-name.ts` (video stills on `/watch` morph into the watch-page player frame). Names must be unique per page — never name elements that can render the same slug twice (e.g. the continue-watching rail).
- `prefers-reduced-motion: reduce` disables navigation transitions globally; no per-component guards needed.

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

1. Look in `src/components/ui/` before building new primitives.
2. Use Storybook to develop in isolation.
3. `astro check` runs as part of `bun run build`. The vitest suite is run separately via `bun run test`.
4. Biome formats: `bun run format`. Tabs, double quotes.
5. Test both light and dark schemes manually before shipping.
6. Be responsive and accessible — the editorial system inherits the same constraints, only the surface treatment changed.

## Project-Specific Conventions

- Commit format: `feat(rawkode.academy/website): description`. See root CLAUDE.md for the full type list.
- Indentation: tabs. YAML: spaces.
- Astro: prop bindings to Vue components use plain `prop={value}` syntax, **not** Vue's `:prop=` (Astro errors on the colon-prefixed form).
- React `client:only="react"` should be reserved for genuinely interactive surfaces. SEO falls off otherwise.
- Long-form prose flows through `.prose` styles in `global.css` (editorial ramp: serif italic h1/h2, hairline blockquote/code chip, mono numbered lists).

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

- Editorial primitives: `src/components/ui/`
- Landing composition: `src/components/landing/`
- Theme utilities: `src/lib/theme.ts`
- Global styles: `src/styles/global.css`
- UnoCSS config: `uno.config.ts`
- Storybook: `bun run storybook`
