# Theme System

The website supports multiple color themes that can be switched by users.

## Available Themes

Each theme exposes dedicated light and dark palettes so typography, borders, and glass panels stay legible regardless of the "dark" class on the `<html>` element. During the audit we introduced shared tokens (`--surface-base`, `--surface-overlay`, `--surface-card`, `--surface-card-muted`, `--surface-border`, `--surface-border-strong`, and shadow definitions) that every theme now sets explicitly for both modes along with bespoke gradients for `--app-backdrop`.

### 1. Rawkode Green (Default)
- **Primary Color**: `#04B59C` (Teal)
- **Secondary Color**: `#85FF95` (Green)
- **Accent Color**: `#23282D` (Black)

### 2. Rawkode Blue
- **Primary Color**: `#5F5ED7` (Purple)
- **Secondary Color**: `#00CEFF` (Cyan)
- **Accent Color**: `#111827` (Dark Blue-Gray)

### 3. Catppuccin
- **Primary Color**: `#CBA6F7` (Mauve)
- **Secondary Color**: `#F5C2E7` (Pink)
- **Accent Color**: `#1E1E2E` (Base)

### 4. Dracula
- **Primary Color**: `#BD93F9` (Purple)
- **Secondary Color**: `#FF79C6` (Pink)
- **Accent Color**: `#282A36` (Background)

### 5. Solarized
- **Primary Color**: `#268BD2` (Blue)
- **Secondary Color**: `#2AA198` (Cyan)
- **Accent Color**: `#002B36` (Base03)

### 6. Pride (Cotton Candy Palette)
- **Primary Color**: `#FF595E` (Red)
- **Secondary Color**: `#FFCA3A` (Yellow)
- **Accent Color**: `#6A4C93` (Purple)
- Vibrant Cotton Candy color palette with 5 colors: Red, Yellow, Green, Blue, Purple
- **Light Surfaces**: Pastel glass panels with warm highlights keep the cotton candy palette soft while maintaining contrast on white typography.
- **Dark Surfaces**: Deep berry gradients paired with glowing yellow borders preserve the vibrancy of the pride stripes without washing out controls.

### 7. LGBTQ+ (Transgender Pride Flag)
- **Primary Color**: `#5BCEFA` (Light Blue)
- **Secondary Color**: `#F5A9B8` (Pink)
- **Accent Color**: `#FFFFFF` (White)
- Based on the transgender pride flag colors
- **Light Surfaces**: Frosted cyan cards and subtle borders echo the white stripe of the flag while ensuring icons remain visible on bright backgrounds.
- **Dark Surfaces**: Midnight blue gradients with luminous cyan and pink glows keep the theme readable when `.dark` is applied.

## How to Switch Themes

### Via Theme Toggle Button
Click the theme toggle button in the navigation bar to cycle through all available themes. The button will display the current theme name when labeled.

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
- `toggleTheme()`: Cycle to the next theme
- `getThemeDisplayName(theme)`: Get human-readable theme name
- `getThemeColors()`: Get color values for the current theme
- `ALL_THEMES`: Array of all available themes

### Components
- **ThemeToggle.vue**: Vue component for the theme toggle button
- **ThemeScript.astro**: Inline script to prevent FOUC (Flash of Unstyled Content)
- **Command Palette**: Includes theme selection commands

## Persistence
The selected theme is stored in `localStorage` under the key `rawkode-theme` and will be automatically applied on subsequent visits.

## Adding New Themes

To add a new theme:

1. Add the theme name to the `Theme` type in `src/lib/theme.ts`
2. Add it to the `ALL_THEMES` array
3. Add CSS variables in `src/styles/global.css` with selector `:root[data-theme="theme-name"]`
4. Add color values to `getThemeColors()`
5. Add display name to `getThemeDisplayName()`
