# Rawkode Academy Website - Development Guide

## Component Library & Design System

### Theme System

The website supports two brand themes that can be switched dynamically:

#### Available Themes

1. **rawkode-green** (Default)
   - Primary: Teal `#04B59C` (4, 181, 156)
   - Secondary: Green `#85FF95` (133, 255, 149)
   - Accent: Black `#23282D` (35, 40, 45)
   - Gradient: 45° angle from Teal to Green

2. **rawkode-blue**
   - Primary: Purple `#5F5ED7` (95, 94, 215)
   - Secondary: Cyan `#00CEFF` (0, 206, 255)
   - Accent: Dark Blue-Gray `#111827` (17, 24, 39)
   - Gradient: 45° angle from Purple to Cyan

#### Using Themes in Components

All components should use semantic Tailwind classes that automatically adapt to the current theme:

```vue
<!-- ✅ Good - Uses theme-aware classes -->
<div class="bg-primary text-white">
  <h1 class="text-primary-content">Title</h1>
  <p class="text-secondary-content">Description</p>
  <button class="bg-gradient-primary">Click me</button>
</div>

<!-- ❌ Bad - Hardcoded colors -->
<div class="bg-[#04B59C] text-white">
  <h1 class="text-gray-900">Title</h1>
  <button style="background: linear-gradient(135deg, #04b59c, #85ff95)">
    Click me
  </button>
</div>
```

#### Theme-Aware Color Classes

| Class | Description |
|-------|-------------|
| `text-primary` / `bg-primary` / `border-primary` | Uses current theme's primary color |
| `text-secondary` / `bg-secondary` / `border-secondary` | Uses current theme's secondary color |
| `text-primary-content` | Primary text color (gray-900 / white) |
| `text-secondary-content` | Secondary text color (gray-700 / gray-300) |
| `text-muted` | Muted text color (gray-600 / gray-400) |
| `bg-gradient-primary` | Brand gradient at 45° |
| `bg-gradient-secondary` | Brand gradient at 45° |
| `bg-gradient-card` | Subtle brand gradient for cards |
| `border-glass` | Glass morphism border |
| `card-shadow` | Standard card shadow |
| `card-hover` | Card hover effects |

#### Implementing Theme Toggle

1. **Add the theme script to your layout's `<head>`:**

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

2. **Add the ThemeToggle component to your UI:**

```vue
<script setup>
import { ThemeToggle } from "@/components/ui";
</script>

<template>
  <!-- Icon only -->
  <ThemeToggle />

  <!-- With label -->
  <ThemeToggle :showLabel="true" />

  <!-- Button variant -->
  <ThemeToggle variant="button" size="lg" :showLabel="true" />
</template>
```

3. **Programmatic theme control:**

```typescript
import { setTheme, getTheme, toggleTheme } from "@/lib/theme";

// Get current theme
const current = getTheme(); // "rawkode-green" | "rawkode-blue"

// Set specific theme
setTheme("rawkode-blue");

// Toggle between themes
const newTheme = toggleTheme();

// Listen for theme changes
window.addEventListener("theme-change", (event) => {
  console.log("Theme changed to:", event.detail.theme);
});
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
