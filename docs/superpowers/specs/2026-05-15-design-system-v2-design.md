# Design System v2 — Panda CSS + Park UI

**Status:** Approved 2026-05-15. Branch: `feat/design-system-v2`.

## Goals

Replace the current Tailwind v4 + ad-hoc Vue primitives with a coherent, token-driven design system built on Panda CSS and Park UI. Every page in `projects/rawkode.academy/website/` rebuilt and verified in Chrome MCP before the branch merges to `main`.

The verification bar: each page is *at parity with or better than* the prod equivalent. Better = cleaner alignment, better dark-mode contrast, more consistent spacing, fewer ad-hoc utility soups.

## Decisions (locked)

1. **Strategy: Greenfield.** Strip Tailwind. Install Panda + Park UI. Rewrite every page on the new stack. One long-lived branch; no shipping until the Chrome MCP sweep passes.
2. **Framework: Mixed.** Vue for the new design system (Park UI Vue + Ark UI Vue, matches existing UI primitives). React islands (HeroTypewriter, VideoPlayer, Vidstack player, etc.) stay untouched.
3. **Themes: One brand, dual mode.** Single brand — the existing `rawkode-blue` palette. Light + dark only. Brand-toggle UI deleted.

## Palette

| Token             | Hex       | RGB                |
| ----------------- | --------- | ------------------ |
| Brand primary     | `#5F5ED7` | `95, 94, 215`      |
| Brand secondary   | `#00CEFF` | `0, 206, 255`      |
| Brand accent      | `#111827` | `17, 24, 39`       |
| Brand gradient    | 45° from primary → secondary |          |

Semantic token families: `fg.{primary,secondary,muted,subtle,inverted}`, `bg.{canvas,surface,raised,sunken,overlay}`, `border.{default,muted,strong,focus}`, `brand.{primary,secondary,accent,gradient-from,gradient-to}`, plus full ParkUI-compatible scales for radii, spacing, type, shadows, motion.

## Architecture

### Stack

- **`@pandacss/dev`** — Panda runtime + CLI for codegen.
- **`@pandacss/astro`** — Astro integration that runs codegen at build time and emits the global stylesheet.
- **`@park-ui/panda-preset`** — Park UI preset for Panda; provides recipes for every Park UI component.
- **`@ark-ui/vue`** — Headless primitives Park UI wraps.
- **`@astrojs/vue`** — already installed; stays.
- **Tailwind packages — removed** (`tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/forms`).

### Component layers

1. **Park UI primitives** (`src/components/ui/`): Button, Card, Badge, Dialog, Popover, Tooltip, Toast, Tabs, Accordion, Avatar, Checkbox, Combobox, Input, RadioGroup, Select, Slider, Switch.
2. **Layout primitives** (same dir): Container, Stack, Grid, GlassPanel, Hero. Hand-built atop Park UI styles and Panda recipes.
3. **Composite components** (`src/components/...`): ArticleCard, ShowCard, Breadcrumb, NewsletterCTA, Header, Footer, etc. Vue or Astro, composed from primitives.
4. **Page templates** (`src/pages/...`): every `.astro` page rewritten to use the layers above. No Tailwind utilities anywhere by the end.

### Theme runtime

- `<ThemeScript />` injects an inline script in `<head>` that sets `documentElement.classList.toggle('dark', ...)` before paint to avoid FOUC.
- Respects `localStorage.theme` first, then `prefers-color-scheme`.
- `<ThemeToggle />` is a small Vue island with a single light/dark switch (brand-toggle UI deleted).
- Panda `conditions: { dark: '.dark &' }` plumbs semantic tokens through the toggle.

### Astro integration

- `astro.config.mts`: remove `@tailwindcss/vite` plugin, add `@pandacss/astro` integration.
- `src/styles/global.css` keeps a small reset + Park UI base style imports; everything else is Panda-generated.
- Vite alias `@/` stays.

## Build / verification flow

- `bun run dev` running in background on `localhost:4321` throughout.
- Per-page workflow:
  1. Rebuild the page on Panda + Park UI primitives.
  2. Open the URL in Chrome MCP, screenshot light + dark mode, scroll, capture console.
  3. Diff against prod (`https://rawkode.academy/...`) — note any regressions.
  4. If parity or better, mark the page task done. If worse, fix and re-verify.
- Final sweep visits every top-level URL plus one exemplar per dynamic route.

## Sequencing

Foundation work (F1–F5) lands first as discrete commits on the branch. Pages roll in batches (P1–P5) each as its own commit or small group.

| Phase | Work | Verify |
| --- | --- | --- |
| F1    | Strip Tailwind, install Panda + Park UI deps, update astro.config | `bun run dev` starts; `bunx panda codegen` succeeds; styled-system/ exists |
| F2    | Token system in `panda.config.ts`; semantic tokens; type/spacing/radii scales | Codegen succeeds; preview Park UI Button renders branded |
| F3    | ThemeScript + ThemeToggle rewritten | No FOUC; toggle flips `.dark` class; localStorage persists |
| F4    | Park UI primitives scaffolded into `src/components/ui/` | Each component renders in isolation on a test route |
| F5    | Layout primitives + Hero | Layout renders, dark mode works, no console errors |
| P1    | Header/Footer + `<Page>` wrapper | Every route renders header/footer correctly |
| P2    | Homepage | Chrome MCP: parity-or-better vs prod |
| P3    | Content list pages (9) | Chrome MCP per page |
| P4    | Content detail templates (9) | Chrome MCP per template (one exemplar slug each) |
| P5    | Long-tail static pages | Chrome MCP per page |
| V1    | Final sweep | All pages verified; PR opened |

## Risk acknowledgements

- Greenfield means many pages render incorrectly mid-flight. The task list tracks unfinished pages. Branch is long-lived and pushed continuously; not merged until the sweep passes.
- Astro + Vue + Park UI SSR may have edge cases (client-only directives for stateful Ark UI components). Will address per-component as they surface.
- Storybook stories (`Card.stories.tsx`, `Hero.stories.tsx`) likely break — rewriting is in scope, removing them is fine if they're not actively used.
- Existing structured-data work (JSON-LD components, feeds, sitemaps) is **out of scope** — none of it depends on Tailwind, all of it should pass through unchanged.

## Out of scope

- Any non-website project (platform services, dagger modules, infrastructure).
- API / GraphQL changes.
- Content edits.
- Performance work beyond what falls out of the rebuild naturally.
