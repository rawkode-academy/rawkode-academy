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

## Dialog

The shared components currently include an Ark UI dialog and tabs, both styled with Panda slot recipes:

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

The dialog is rendered through `body` and owns viewport scrolling, so long forms remain reachable on small screens. Its `dialog` shadow is an intentional modal-elevation exception: the backdrop and elevated surface are kept visually distinct from ordinary panels.

## Website integration

The production website homepage uses the Academy palette and the `academyPage`
recipe. It renders live content from every publishable collection in one
chronological Latest feed:

- videos
- articles
- news
- courses
- learning paths

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
