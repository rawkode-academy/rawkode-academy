# Rawkode Academy Design System

The shared design-system boundary for Rawkode Academy applications.

This package is intentionally small in its first iteration:

- Panda CSS v2 owns tokens and recipes.
- Ark UI owns accessible interactive behavior.
- Vue components are the first framework adapter because the Academy website's common interactive path is Vue islands.
- The Academy website owns its small application reset in `src/styles/global.css`; this package stays composable by leaving Panda preflight disabled.

## Development

Run from the repository root after `cuenv sync -A`:

```sh
bun run --cwd packages/design-system build
bun run --cwd packages/design-system check
```

The generated `styled-system/` directory is produced by Panda's build step. It is part of the package's local build contract and should be regenerated whenever `panda.config.ts` changes.

## Layers

The package has three layers. Reach for the highest one that fits.

| Layer | Where | What |
| --- | --- | --- |
| Components | `src/vue` | `Button`, `Dialog`, `Tabs`, `NavigationDrawer`: behaviour plus styles |
| Primitive recipes | `src/recipes/button.ts`, `academyLabel`, `academyContainer`, ... | One element, usable from Astro, Vue and React |
| Style fragments | `src/styles` | Plain objects spread into any recipe slot; see the table below |

Page recipes (`academyPage`, `academyWatch`, ...) sit on top and own layout
only. A page recipe that needs an action, a focus ring or the grid motif
composes the shared piece; it does not restate it.

### Button

```astro
---
import { button } from "@rawkodeacademy/design-system";
---
<a class={button({ size: "lg" })} href="/watch">
	Watch the latest session <span data-part="arrow" aria-hidden="true">→</span>
</a>
<button class={button({ variant: "outline" })} type="submit">Apply filters</button>
```

```vue
<script setup lang="ts">
import { Button } from "@rawkodeacademy/design-system/vue";
</script>

<template>
	<Button href="/read" arrow>Read the article</Button>
	<Button variant="outline" :loading="saving" @click="save">Save</Button>
</template>
```

| Variant | Use |
| --- | --- |
| `solid` | The one primary action in a view |
| `outline` | A secondary action; also toggles via `aria-pressed` |
| `quiet` | Toolbar and in-panel controls |

Pass `surface: "ink"` to any variant that sits on an ink surface (hero,
masthead, video stage, footer). Ink surfaces carry their own accent, border
and focus tokens.

Sizes are `sm` (36px), `md` (44px, the default) and `lg` (48px). `fullWidth`
stretches a form submit; `icon` makes a square control and needs an
`aria-label`.

### Style fragments

A fragment is the single definition of something more than one surface
draws. A page recipe spreads it into a slot and adds only what is local:
layout, padding, an entrance animation.

| File | Fragments | Use |
| --- | --- | --- |
| `focus.ts` | `focusRing`, `focusRingInset`, `focusRingInk` | Under `_focusVisible`; never hand-write an outline |
| `systemGrid.ts` | `systemGridTop`, `systemGridBottom` | The grid motif, ink surfaces only |
| `motion.ts` | `scrollReveal` | Scroll-driven entrance for rows and cards |
| `ink.ts` | `inkSurface`, `inkStage` | The ink surface that opens a page: hero, masthead, Search, video stage |
| `ledger.ts` | `ruledList`, `ledgerRow`, `ledgerDate`, `ledgerMedia`, `ledgerImage`, `ledgerBody`, `ledgerTitle`, `ledgerDescription` | The chronological row shared by Read and News |
| `media.ts` | `videoFrame`, `coverImage`, `coverImageZoom`, `runtimeBadge` | The 16:9 still, the image that fills it, the runtime set over it |
| `surface.ts` | `panelSurface`, `linkedPanel`, `pill` | Framed panels (static and linked) and the tag outline, the one fully round surface |
| `link.ts` | `textLink` | The standalone text link with a travelling arrow |
| `field.ts` | `inputField` | A text input's surface and states; the slot sets the metrics |
| `type.ts` | `posterTitle`, `mastheadTitle`, `ledeText`, `sectionTitle`, `headingLg`, `headingMd`, `cardTitle`, `monoMeta`, `kicker` | The type steps more than one surface sets |

```ts
import { sva } from "../../styled-system/css";
import { inputField } from "../styles/field";
import { inkStage } from "../styles/ink";
import { ledgerDate, ledgerRow, ruledList } from "../styles/ledger";
import { runtimeBadge, videoFrame } from "../styles/media";
import { linkedPanel } from "../styles/surface";
import { ledeText, mastheadTitle, monoMeta } from "../styles/type";

export const example = sva({
	slots: ["masthead", "title", "lede", "list", "row", "date", "kind", "card", "still", "runtime", "input"],
	base: {
		// The fragment is the surface; the slot owns its padding.
		masthead: { ...inkStage, paddingBlock: "academy-hero-tight" },
		title: mastheadTitle,
		lede: { ...ledeText, color: "academy.inkTextSoft" },
		// A whole fragment can be the slot.
		list: ruledList,
		row: ledgerRow,
		date: ledgerDate,
		kind: { ...monoMeta, display: "flex", gap: "2" },
		card: { ...linkedPanel, display: "flex", flexDirection: "column" },
		still: { ...videoFrame, borderRadius: "academy-m" },
		runtime: runtimeBadge,
		input: { ...inputField, minHeight: "12", paddingInline: "4" },
	},
});
```

Three rules keep fragments honest:

- **A spread is shallow.** A slot that spreads a fragment and then declares
  its own `_hover`, `_lg` or `"& strong"` replaces the fragment's whole
  block. Override with flat keys, or restate the block (a slot with its own
  hover on a `linkedPanel` restates `borderColor: "academy.accent"`).
- **`border: "hairline"` already carries `academy.border`.** Set a border
  colour only when it differs (ink borders, input borders, a hover accent).
- **Fragments share pieces, not containers.** `academyPage.card` is the one
  video card (the library, show and technology recordings, the rail under a
  video). The related card under an article uses the same still, image and
  title but stays its own slot, because it is closed by a rule.

The ledger's markup contract is documented at the top of
`src/styles/ledger.ts`. Storybook shows each fragment through a slot that
spreads it: `Design System/Ledger`, `Media card`, `Ink masthead` and
`Surfaces and type`.

### Static extraction

Panda extracts styles statically. A fragment must be a plain object literal
(spreading other literals is fine). A function that builds a style object is
not followed: the recipe still returns class names at runtime, but no CSS is
generated. The website's `design-system-coverage` test fails when a recipe
emits a class the stylesheet does not define.

A fragment may build on a sibling fragment (`ledger.ts` spreads `videoFrame`
from `media.ts`); the extractor follows those imports. A recipe may import
only `../../styled-system/css` and `../styles/*`, which is what the website's
SSR tests evaluate.

## Dialog

The Ark UI dialog and tabs are styled with Panda slot recipes:

```vue
<script setup lang="ts">
import { Dialog } from "@rawkodeacademy/design-system/vue";
</script>

<template>
	<Dialog title="How Rawkode teaches">
		<template #trigger>See the approach</template>
		<p>Dialog content.</p>
	</Dialog>
</template>
```

Applications must import `@rawkodeacademy/design-system/styles.css` once at their application styling boundary. Applications own any global normalization needed around the package's recipes.

The dialog is rendered through `body` and owns viewport scrolling, so long forms remain reachable on small screens. Its backdrop, like the navigation drawer's, is `academy.scrim`: one black veil for both colour schemes, because a scrim mixed from a themed colour stops dimming a dark page. Its `dialog` shadow is an intentional modal-elevation exception: the backdrop and elevated surface are kept visually distinct from ordinary panels.

## Website integration

The production website homepage uses the Academy palette and the `academyPage`
recipe. It is rendered from live content: a statement hero (`hero`, `title`,
`system`), the next live stream and the latest session as a pair of equals
(`pair*`, `facts`; the latest session alone is a spread: `spread`, `plate`,
`colophon`), the field index of the four collections with their real counts
on an ink band (`indexBand`, `index*`), a compact ledger with an equal
column per collection (`columns`, `column*`, `entry*`) and learning paths as
a ruled table (`paths`, `pathRow*`).

Format-specific routes such as `/watch` and `/read` remain focused views. The
homepage uses Panda-generated classes plus the shared Ark Tabs and Dialog.
# Academy production shell and page primitives

Academy documents use `@/wrappers/page.astro`, which owns the head, one
`main#main-content`, skip link, shared header, footer, and generated Panda CSS.
Pass title/description/Open Graph props normally; put page-specific JSON-LD,
feed links, and preloads in `slot="extra-head"`. Do not nest another main or
recreate site navigation in content components. Embeds may use the minimal layout.

```astro
---
import Page from "@/wrappers/page.astro";
import { academyLayout } from "@rawkodeacademy/design-system";
const s = academyLayout({ width: "wide" }); // or "reading"
---
<Page title="Courses" description="Learn by building.">
  <div class={s.root}>
    <section class={s.hero}>
      <div class={s.container}>
        <p class={s.kicker}>Learn</p>
        <h1 class={s.title}>Courses</h1>
        <p class={s.description}>Practical paths through production systems.</p>
      </div>
    </section>
    <section class={s.section} aria-label="Available courses">
      <div class={s.grid}><slot /></div>
    </section>
  </div>
</Page>
```

`academyLayout` slots: `root`, `hero`, `container`, `kicker`, `title`,
`description`, `section`, `sectionHeader`, `sectionTitle`, `grid`, `card`,
`cardMedia`, `cardBody`, `cardTitle`, `meta`, `prose`, `sidebar`, `split`,
`toolbar`, `input`, `button`, `buttonSecondary`, `tag`, `empty`, `notice`,
`breadcrumbs`, `list`, `table`, `tableWrap`.

`academyShell` is the production chrome recipe. `NavigationDrawer` from
`@rawkodeacademy/design-system/vue` accepts `groups` (label plus items with
label/href), `currentPath`, and an optional stable `id`. It uses Ark Dialog
for focus trapping, Escape/outside dismissal, focus restoration, and scroll
locking. Its server fallback is a real link to the complete footer navigation.
Website-owned `src/lib/navigation.ts` supplies the shared route inventory.

All custom styles must live in package recipes so Panda's package-local
extraction sees them. Rebuild the package after recipe changes. Canonical SVG
artwork remains in the website branding directory and is rendered inline using
currentColor; never duplicate it into `public/`.
