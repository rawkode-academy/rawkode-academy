# Theme System

The website ships a **single brand theme — Rawkode Blue** — with both light and dark color schemes. Users can flip between light and dark; the brand palette is fixed.

## Palette

- **Primary**: `#5F5ED7` (Purple)
- **Secondary**: `#00CEFF` (Cyan)
- **Accent**: `#111827` (Dark Blue-Gray)
- **Brand gradient**: 135° from `--brand-primary` → `--brand-secondary`

## Color schemes

| Scheme | When applied | Surface base |
|--------|--------------|--------------|
| Light  | default      | `#eef2ff` |
| Dark   | `html.dark`  | `#040712` |

## CSS variables

Defined in `src/styles/global.css`:

- `--brand-primary`, `--brand-secondary`, `--brand-accent` — RGB triplets for the brand palette.
- `--surface-base`, `--surface-overlay`, `--surface-card`, `--surface-card-muted`, `--surface-border`, `--surface-border-strong` — semantic surfaces, swapped under `html.dark`.
- `--surface-shadow`, `--surface-shadow-strong` — shadow ramp tokens.
- `--app-backdrop` — full-page radial-gradient backdrop, swapped under `html.dark`.
- Spacing tokens (`--space-page-*`, `--space-section-*`, `--space-stack-*`, `--space-card-pad-*`).

## Library API

`src/lib/theme.ts`:

- `getColorScheme()` / `setColorScheme(scheme)` / `toggleColorScheme()` — the only knobs users actually need.
- `initTheme()` — call early to apply the persisted color-scheme preference and avoid FOUC.
- `getThemeColors()` — returns the canonical brand palette.

The legacy `getTheme` / `setTheme` / `toggleTheme` / `ALL_THEMES` / `getThemeDisplayName` exports remain as thin shims so older callers (the toggle button, the command palette) keep compiling until the next loop replaces those UIs with a dark-mode toggle.

## Persistence

The color scheme is stored in `localStorage` under the key `rawkode-color-scheme` (`"light"` | `"dark"`).
