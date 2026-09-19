# Rawkode Academy Design System

The shared design-system boundary for Rawkode Academy applications.

This package is intentionally small in its first iteration:

- Panda CSS v2 owns tokens and recipes.
- Ark UI owns accessible interactive behavior.
- Vue components are the first framework adapter because the Academy website's common interactive path is Vue islands.
- Panda preflight is disabled while the website still uses UnoCSS. Reset ownership will move in a later application migration.

## Development

Run from the repository root after `cuenv sync -A`:

```sh
bun run --cwd packages/design-system build
bun run --cwd packages/design-system check
```

The generated `styled-system/` directory is produced by Panda's build step. It is part of the package's local build contract and should be regenerated whenever `panda.config.ts` changes.

## Dialog

The first component is an Ark UI dialog styled with a Panda slot recipe:

```vue
<script setup lang="ts">
import { Dialog } from "@rawkodeacademy/design-system/vue";
</script>

<template>
	<Dialog title="Preview">
		<template #trigger>Open preview</template>
		<p>Dialog content.</p>
	</Dialog>
</template>
```

Applications must import `@rawkodeacademy/design-system/styles.css` once at their application styling boundary. The first package does not enable a reset, so it can be piloted beside the existing Academy UnoCSS styles without taking ownership of global normalization.

The dialog is rendered through `body` and owns viewport scrolling, so long forms remain reachable on small screens. Its `dialog` shadow is an intentional modal-elevation exception: the backdrop and elevated surface are kept visually distinct from ordinary panels.
