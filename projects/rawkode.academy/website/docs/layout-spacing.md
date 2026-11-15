# Layout & Spacing System

Page rhythm comes from the design-system package (`packages/design-system`), not from `src/styles/global.css`. The website has no utility-CSS compiler, so Tailwind-style classes (`px-4`, `gap-8`, `page-px`, `section-py`, `card-padding`) have no CSS behind them. The older `--space-*` custom properties and the helper classes built on them are retired; do not add new uses.

## Tokens

Spacing and size tokens are defined in `packages/design-system/panda.config.ts`. Panda emits every token as a custom property in `styled-system/styles.css`, so they are available to recipes by name and to component-scoped styles as variables.

| Recipe token | CSS variable | Value | Intended use |
| --- | --- | --- | --- |
| `spacing.academy-gutter` | `--spacing-academy-gutter` | `clamp(20px, 4vw, 48px)` | Horizontal gutter for the page shell and section containers |
| `spacing.academy-gutter-wide` | `--spacing-academy-gutter-wide` | `48px` | Fixed gutter where the fluid one must not shrink |
| `spacing.academy-section` | `--spacing-academy-section` | `64px` | Vertical padding between major sections |
| `spacing.academy-section-wide` | `--spacing-academy-section-wide` | `88px` | Vertical padding for sections that need more room |
| `spacing.academy-hero` | `--spacing-academy-hero` | `clamp(3rem, 7vw, 6rem)` | Hero and masthead block padding |
| `spacing.academy-hero-tight` | `--spacing-academy-hero-tight` | `clamp(2rem, 4vw, 3.5rem)` | Compact hero block padding |
| `sizes.academy-shell` | `--sizes-academy-shell` | `1180px` | Page shell width, gutters included |
| `sizes.academy-reading-shell` | `--sizes-academy-reading-shell` | `776px` | Long-form reading column shell |
| `sizes.academy-copy` | `--sizes-academy-copy` | `680px` | Maximum measure for running copy |

The fluid values are defined with `clamp`, so they shrink on small screens without custom breakpoints. Stack and grid gaps use the numeric Panda spacing scale (`gap: "4"`, `gap: "6"`) inside recipes.

## Primitives

- `academyContainer({ size, padding })` centres content and owns the gutter. `size: "xl"` is the 1180px shell and `padding: "lg"` applies `academy-gutter`. The website `Container` component (`@/components/ui`) wraps the same recipe.
- `academyLayout({ width })` provides the page slots (`root`, `section`, `container`, `grid`, `card`, `prose` and others) with section rhythm already applied.

Example:

```astro
---
import { academyLayout } from "@rawkodeacademy/design-system";

const styles = academyLayout({ width: "wide" });
---

<div class={styles.root}>
	<section class={styles.section} aria-label="Shows">
		<div class={styles.container}>
			<div class={styles.grid}>...</div>
		</div>
	</section>
</div>
```

## Adoption guidelines

1. Reach for a recipe slot or `academyContainer` first. Page shells, sections and cards should not set their own gutters.
2. Inside a recipe, use spacing tokens by name. `strictTokens` is on, so a raw value needs the `"[value]"` escape and a reason.
3. In a component-scoped `<style>` block, read the generated variables (`padding-inline: var(--spacing-academy-gutter)`) rather than repeating a literal.
4. Shared style fragments must stay plain object literals. Panda extracts styles statically, so a function that builds a style object produces class names with no CSS.
5. When a layout needs a rhythm the tokens do not cover, add a token in `panda.config.ts` and rebuild the package (`bun run check` in `packages/design-system`) so the vocabulary stays shared.
