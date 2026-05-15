# Theme System

The website supports two brand themes. The longer-term direction is to consolidate on **Rawkode Blue** with light/dark modes only — see `DS.md` for the in-flight design-system pass.

## Available Themes

Each theme exposes dedicated light and dark palettes so typography, borders, and glass panels stay legible regardless of the `dark` class on the `<html>` element. Shared tokens (`--surface-base`, `--surface-overlay`, `--surface-card`, `--surface-card-muted`, `--surface-border`, `--surface-border-strong`, and shadow definitions) are set explicitly for both modes, along with a bespoke gradient for `--app-backdrop`.

### 1. Rawkode Green (Default)
- **Primary Color**: `#04B59C` (Teal)
- **Secondary Color**: `#85FF95` (Green)
- **Accent Color**: `#23282D` (Black)

### 2. Rawkode Blue
- **Primary Color**: `#5F5ED7` (Purple)
- **Secondary Color**: `#00CEFF` (Cyan)
- **Accent Color**: `#111827` (Dark Blue-Gray)

## How to Switch Themes

### Via Theme Toggle Button
Click the theme toggle button in the navigation bar to switch between the two themes.

### Via Command Palette
1. Open the command palette with `Cmd+K` (Mac) or `Ctrl+K` (Windows/Linux)
2. Type "theme" to filter theme options
3. Select your desired theme from the list
4. The current theme will be marked as "(active)"

## Theme Implementation

### CSS Variables
Each theme defines custom CSS variables in `src/styles/global.css`:
- `--brand-primary`: RGB values for the primary color
- `--brand-secondary`: RGB values for the secondary color
- `--brand-accent`: RGB values for the accent color
- `--app-backdrop`: Gradient background using theme colors

### Theme Management
The theme system is managed by `src/lib/theme.ts` which provides:
- `getTheme()`: Get the current theme
- `setTheme(theme)`: Set and persist a theme
- `toggleTheme()`: Switch to the other theme
- `getThemeDisplayName(theme)`: Get human-readable theme name
- `getThemeColors()`: Get color values for the current theme
- `ALL_THEMES`: Array of available themes

### Components
- **ThemeToggle.vue**: Vue component for the theme toggle button
- **ThemeScript.astro**: Inline script to prevent FOUC (Flash of Unstyled Content)
- **Command Palette**: Includes theme selection commands

## Persistence
The selected theme is stored in `localStorage` under the key `rawkode-theme` and will be automatically applied on subsequent visits.
