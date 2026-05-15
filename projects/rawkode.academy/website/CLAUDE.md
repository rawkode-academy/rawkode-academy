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

### Theme: Rawkode Blue

The website ships a single brand theme — **Rawkode Blue** — with light and dark colour schemes. Users toggle light/dark; the brand palette is fixed.

#### Palette

- **Primary**: `#5F5ED7` (Purple)
- **Secondary**: `#00CEFF` (Cyan)
- **Accent**: `#111827` (Dark Blue-Gray)
- **Brand gradient**: 135° from `--brand-primary` → `--brand-secondary`

#### Using brand colours in components

Always reach for semantic Tailwind classes — never hardcode hex values:

```vue
<!-- ✅ Good -->
<div class="bg-primary text-white">
  <h1 class="text-primary-content">Title</h1>
  <p class="text-secondary-content">Description</p>
  <button class="bg-gradient-primary">Click me</button>
</div>

<!-- ❌ Bad -->
<div class="bg-[#5F5ED7] text-white">
  <h1 class="text-gray-900 dark:text-white">Title</h1>
</div>
```

#### Brand colour classes

| Class | Description |
|-------|-------------|
| `text-primary` / `bg-primary` / `border-primary` | Uses `--brand-primary` |
| `text-secondary` / `bg-secondary` / `border-secondary` | Uses `--brand-secondary` |
| `text-primary-content` | Primary text colour (gray-900 / white) |
| `text-secondary-content` | Secondary text colour (gray-700 / gray-300) |
| `text-muted` | Muted text colour (gray-600 / gray-400) |
| `bg-gradient-primary` | 135° brand gradient (primary → secondary) |
| `bg-gradient-secondary` | 315° brand gradient (reverse sweep) |
| `bg-gradient-hero` / `bg-gradient-hero-alt` | Brand-tinted hero washes (mode-aware) |
| `bg-gradient-card` | Subtle brand gradient for cards |
| `border-glass` | Glass morphism border |
| `card-shadow` / `card-shadow-elevated` | Surface shadows |
| `card-hover` | Card hover interactions |

#### Radius scale

Use the radius scale tokens instead of `rounded-[1.35rem]` style literals:

| Token | Class | Value | Use for |
|-------|-------|-------|---------|
| `--radius-xs`   | `rounded-xs`   | 0.375rem | Chips, small pills |
| `--radius-sm`   | `rounded-sm`   | 0.5rem   | Inputs, small buttons |
| `--radius-md`   | `rounded-md`   | 0.75rem  | Secondary cards |
| `--radius-lg`   | `rounded-lg`   | 1rem     | Buttons, default surfaces |
| `--radius-xl`   | `rounded-xl`   | 1.2rem   | Soft / muted panels, stat panels |
| `--radius-2xl`  | `rounded-2xl`  | 1.35rem  | Glass cards, section shells |
| `--radius-3xl`  | `rounded-3xl`  | 1.5rem   | Glass panels (hero-level) |
| `--radius-pill` | `rounded-full` | 9999px   | Pills, avatars |

#### Motion

Durations and easings live as CSS custom properties on `:root`. Compose them yourself for one-off transitions, or use the pre-baked utility classes for common cases:

| Token | Value | Use for |
|-------|-------|---------|
| `--duration-fast`   | 120ms | Micro-interactions, hover ticks |
| `--duration-base`   | 200ms | Default transitions |
| `--duration-slow`   | 300ms | Card hovers, layout shifts |
| `--duration-slower` | 500ms | Page-level moves |
| `--ease-standard`   | `cubic-bezier(0.4, 0, 0.2, 1)` | Material standard — default |
| `--ease-out`        | `cubic-bezier(0, 0, 0.2, 1)`   | Deceleration |
| `--ease-in`         | `cubic-bezier(0.4, 0, 1, 1)`   | Acceleration |
| `--ease-spring`     | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Gentle overshoot |

Pre-built utility classes: `transition-fast`, `transition-smooth` (base), `transition-card` (slow), `transition-spring`.

#### Shadow ramp

| Token | Use for |
|-------|---------|
| `--shadow-sm` | Subtle elevation (chips, hover-on-light surfaces) |
| `--shadow-md` | Default card shadow |
| `--shadow-lg` | Elevated cards, modals, hovered interactive surfaces |
| `--shadow-xl` | Floating panels, sheets |

Light and dark modes have separate shadow ramps — the variables swap automatically under `html.dark`. The legacy `.card-shadow` / `.card-shadow-elevated` classes now resolve to `--shadow-md` / `--shadow-lg`.

#### Focus ring

Add `class="focus-ring"` to any focusable element that needs a consistent keyboard-only focus outline. The utility uses `:focus-visible` so the ring only appears for keyboard navigation, not mouse clicks. The ring colour is `--brand-primary` with a 2px outline and 2px offset.

The header chrome (sidebar toggle, mobile menu, logo link, search trigger, FAB) and the `Button.vue` / `Button.astro` primitives have already been migrated to `focus-ring` — keep new components on the same pattern instead of hand-rolling `focus:outline-none focus:ring-4 focus:ring-*` boilerplate.

#### Colouring SVGs

Tailwind v4's default `fill-black` / `fill-white` / `fill-gray-*` utilities **don't work reliably** in this codebase — our `@theme` block interacts badly with the default colour palette and SVGs end up rendering `fill: white` regardless of the class. The workaround is to set `fill="currentColor"` on the SVG and drive the colour through a `text-*` class:

```astro
<!-- ❌ Don't — `fill-black dark:fill-white` renders white-on-white in light mode -->
<svg class="fill-black dark:fill-white">…</svg>

<!-- ✅ Do — route through `color` which works correctly -->
<svg fill="currentColor" class="text-primary-content">…</svg>
```

#### Light / Dark / System mode

Two concepts:

- **Preference** (`ColorSchemePreference`) — the user's stored choice: `"light"`, `"dark"`, or `"system"`. `"system"` follows the OS `prefers-color-scheme` media query.
- **Applied scheme** (`ColorScheme`) — the resolved value on the page: `"light"` or `"dark"`.

The site exposes a cycling sun/moon/monitor toggle (`<ThemeToggle />`) and an "Appearance" sub-page in the command palette with all three options. Both wrap the same module:

```typescript
import {
  getColorScheme,           // applied — "light" | "dark"
  getColorSchemePreference, // stored — "light" | "dark" | "system"
  setColorScheme,           // takes preference, persists + applies
  toggleColorScheme,        // cycles light → dark → system → light
} from "@/lib/theme";

// Read the user's preference
const pref = getColorSchemePreference(); // "light" | "dark" | "system"

// Read the applied scheme on the page right now
const applied = getColorScheme(); // "light" | "dark"

// Set the preference (persists to localStorage and updates html.dark)
setColorScheme("system");

// Cycle through preferences
const next = toggleColorScheme();

// Listen for changes (fires on user toggle AND on OS theme change when pref === "system")
window.addEventListener("color-scheme-change", (event) => {
  console.log(
    "preference:", event.detail.preference,
    "applied:", event.detail.scheme,
  );
});
```

When the preference is `"system"`, `theme.ts` installs a `prefers-color-scheme` listener so the page automatically follows OS theme changes without a reload.

`ThemeScript.astro` should sit in the document `<head>` to apply the persisted scheme before paint:

```astro
---
import ThemeScript from "@/components/theme/ThemeScript.astro";
---

<html>
  <head>
    <ThemeScript />
    <!-- other head content -->
  </head>
  <body>
    <!-- content -->
  </body>
</html>
```

Drop the `<ThemeToggle />` component anywhere you need the user-facing switch:

```vue
<script setup>
import { ThemeToggle } from "@/components/ui";
</script>

<template>
  <ThemeToggle />                                        <!-- icon -->
  <ThemeToggle :showLabel="true" />                      <!-- icon + label -->
  <ThemeToggle variant="button" size="lg" :showLabel="true" />
</template>
```

## Component Library

### Core Components

#### Card Component

A unified card component with multiple variants, replacing all individual card implementations.

```vue
<script setup>
import { Card } from "@/components/ui";
import Badge from "@/components/common/Badge.vue";
</script>

<template>
  <!-- Basic glass card -->
  <Card variant="glass">
    <h3>Card Title</h3>
    <p>Card content</p>
  </Card>

  <!-- Card with media and footer -->
  <Card variant="glass" padding="none" href="/article/123">
    <template #badge>
      <Badge variant="primary">Featured</Badge>
    </template>

    <template #media>
      <img src="/image.jpg" alt="Cover" />
    </template>

    <template #overlay>
      <div class="absolute inset-0 bg-gradient-to-tr from-primary/30 to-secondary/20"></div>
    </template>

    <div class="p-6">
      <h3>Article Title</h3>
      <p>Article description</p>
    </div>

    <template #footer>
      <div class="flex items-center justify-between">
        <span>Author</span>
        <span>Date</span>
      </div>
    </template>
  </Card>
</template>
```

**Props:**
- `variant`: `"glass"` | `"solid"` | `"gradient"` | `"bordered"` | `"flat"` (default: `"glass"`)
- `padding`: `"none"` | `"sm"` | `"md"` | `"lg"` (default: `"md"`)
- `rounded`: `"none"` | `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` | `"3xl"` (default: `"xl"`)
- `shadow`: `"none"` | `"sm"` | `"md"` | `"lg"` | `"elevated"` (default: `"md"`)
- `hover`: `boolean` (default: `true`)
- `href`: `string` (optional, renders as link)

**Slots:**
- `badge` - Top-left badge overlay
- `media` - Image or media content
- `overlay` - Overlay on top of media
- `header` - Header section
- `default` - Main content
- `footer` - Footer section

#### Hero Component

A unified hero section component with multiple layouts.

```vue
<script setup>
import { Hero } from "@/components/ui";
import Button from "@/components/common/Button.vue";
</script>

<template>
  <!-- Centered hero -->
  <Hero
    layout="centered"
    background="gradient-hero"
    pattern="grid"
    size="lg"
    badge="Free Course"
    badgeVariant="success"
  >
    <template #title>
      Cloud Native & Kubernetes Education
    </template>

    <template #subtitle>
      Master Cloud Native technologies with expert-led courses.
    </template>

    <template #actions>
      <Button variant="primary" size="lg">Get Started</Button>
      <Button variant="secondary" size="lg">Learn More</Button>
    </template>
  </Hero>

  <!-- Split layout with media -->
  <Hero layout="split" background="gradient-hero" align="left">
    <template #title>Build Production-Ready Apps</template>
    <template #subtitle>Learn modern best practices.</template>

    <template #actions>
      <Button variant="primary" size="lg">Start Learning</Button>
    </template>

    <template #media>
      <img src="/preview.png" alt="Course Preview" />
    </template>
  </Hero>
</template>
```

**Props:**
- `layout`: `"centered"` | `"split"` | `"full-width"` (default: `"centered"`)
- `background`: `"none"` | `"gradient"` | `"gradient-hero"` | `"gradient-hero-alt"` | `"blobs"` (default: `"gradient-hero"`)
- `pattern`: `"none"` | `"grid"` | `"dots"` (default: `"none"`)
- `size`: `"sm"` | `"md"` | `"lg"` | `"xl"` (default: `"lg"`)
- `align`: `"left"` | `"center"` | `"right"` (default: `"center"`)
- `titleTag`: `"h1"` | `"h2"` | `"h3"` (default: `"h1"`)
- `titleSize`: `"xl"` | `"2xl"` | `"3xl"` | `"4xl"` (default: `"4xl"`)
- `badge`: `string` (optional)
- `badgeVariant`: Badge variant (default: `"primary"`)
- `wave`: `boolean` (default: `false`)

**Slots:**
- `breadcrumb` - Breadcrumb navigation
- `badge` - Custom badge (overrides badge prop)
- `title` - Title content (overrides title prop)
- `subtitle` - Subtitle content (overrides subtitle prop)
- `actions` - Action buttons
- `stats` - Statistics or metadata
- `media` - Media content (for split layout)
- `background` - Custom background decorations
- `default` - Additional custom content

### Layout Components

#### Container

```vue
<Container size="xl" padding="lg">
  <!-- Content -->
</Container>
```

**Props:**
- `size`: `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` | `"full"` (default: `"xl"`)
- `padding`: `"none"` | `"sm"` | `"md"` | `"lg"` (default: `"md"`)

#### Stack

```vue
<Stack direction="vertical" spacing="md" align="center">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</Stack>
```

**Props:**
- `direction`: `"vertical"` | `"horizontal"` (default: `"vertical"`)
- `spacing`: `"none"` | `"xs"` | `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` (default: `"md"`)
- `align`: `"start"` | `"center"` | `"end"` | `"stretch"` (default: `"stretch"`)
- `justify`: `"start"` | `"center"` | `"end"` | `"between"` | `"around"` | `"evenly"` (default: `"start"`)
- `wrap`: `boolean` (default: `false`)

#### Grid

```vue
<Grid :cols="1" :colsMd="2" :colsLg="3" gap="md">
  <Card>Card 1</Card>
  <Card>Card 2</Card>
  <Card>Card 3</Card>
</Grid>
```

**Props:**
- `cols`: `1` | `2` | `3` | `4` | `5` | `6` | `"auto-fit"` | `"auto-fill"` (default: `1`)
- `colsMd`: `1` | `2` | `3` | `4` | `5` | `6` (optional)
- `colsLg`: `1` | `2` | `3` | `4` | `5` | `6` (optional)
- `gap`: `"none"` | `"xs"` | `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` (default: `"md"`)

#### GlassPanel

```vue
<GlassPanel variant="medium" blur="xl" padding="lg" rounded="2xl">
  <!-- Glass morphism content -->
</GlassPanel>
```

**Props:**
- `variant`: `"light"` | `"medium"` | `"dark"` (default: `"medium"`)
- `blur`: `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` (default: `"xl"`)
- `padding`: `"none"` | `"sm"` | `"md"` | `"lg"` | `"xl"` (default: `"md"`)
- `rounded`: `"none"` | `"sm"` | `"md"` | `"lg"` | `"xl"` | `"2xl"` | `"3xl"` (default: `"2xl"`)
- `border`: `boolean` (default: `true`)
- `shadow`: `boolean` (default: `true`)

## Migration Guide

### Migrating from Old Card Components

**Before:**
```vue
<a :href="`/read/${id}`" class="h-full">
  <article class="p-0 bg-white/40 dark:bg-gray-800/60 backdrop-blur-2xl rounded-xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.12)] ...">
    <!-- Complex inline styles -->
  </article>
</a>
```

**After:**
```vue
<Card :href="`/read/${id}`" variant="glass" padding="none">
  <template #media>
    <img :src="cover" :alt="alt" />
  </template>
  <!-- Cleaner, reusable structure -->
</Card>
```

### Migrating Colors

Replace all hardcoded color values with semantic classes:

| Old | New |
|-----|-----|
| `text-purple-500` / `text-blue-600` | `text-primary` |
| `bg-[#04B59C]` | `bg-primary` |
| `border-purple-500` | `border-primary` |
| `text-gray-900 dark:text-white` | `text-primary-content` |
| `text-gray-700 dark:text-gray-300` | `text-secondary-content` |
| Complex gradient inline styles | `bg-gradient-primary` or `bg-gradient-secondary` |

## Best Practices

1. **Always use semantic color classes** - Never hardcode hex values or specific color names
2. **Use the Card component** for all card-like UI elements
3. **Use the Hero component** for all hero sections
4. **Use layout components** (Container, Stack, Grid) for consistent spacing
5. **Test both themes** - Ensure your components look good in both rawkode-green and rawkode-blue
6. **Follow the atomic design** - Build complex components from simpler ones
7. **Document new components** - Add Storybook stories for all new UI components

## Development Workflow

1. Check existing components in `src/components/ui/` before creating new ones
2. Use Storybook to develop and test components in isolation
3. Run type checking: `astro check`
4. Run linting: `biome format --write`
5. Test theme switching manually with both themes
6. Ensure components are responsive and accessible

## Resources

- Component Library: `src/components/ui/`
- Theme Utilities: `src/lib/theme.ts`
- Global Styles: `src/styles/global.css`
- Storybook: Run `npm run storybook`
- Documentation: This file + inline JSDoc comments
