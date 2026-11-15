# Theme System

The website ships one brand theme with a light and a dark colour scheme. Users choose light, dark or system; the palette itself is fixed. `DESIGN.md` is the design direction.

## Tokens

Colour, type, radius, spacing and motion tokens are defined once, in `packages/design-system/panda.config.ts`. Panda emits each one as a CSS custom property that resolves per colour scheme (`html.dark` selects the dark values), so a token never needs a second declaration in website CSS.

| Token | CSS variable | Use |
|-------|--------------|-----|
| `academy.canvas` | `--colors-academy-canvas` | Page background |
| `academy.ground` | `--colors-academy-ground` | Recessed surface, placeholders |
| `academy.panel` | `--colors-academy-panel` | Framed panels and cards |
| `academy.border` | `--colors-academy-border` | Hairlines |
| `academy.inputBorder` | `--colors-academy-input-border` | Form controls, stronger rules |
| `academy.text` | `--colors-academy-text` | Primary text |
| `academy.textSoft` | `--colors-academy-text-soft` | Secondary text |
| `academy.textMuted` | `--colors-academy-text-muted` | Metadata |
| `academy.accent` | `--colors-academy-accent` | The next action, focus rings |
| `academy.ink*` | `--colors-academy-ink-*` | Ink surfaces that open and close a page |
| `academy.status*` | `--colors-academy-status-*` | A real state (spruce, amber, rust, sky, violet), never decoration |

Other families follow the same pattern: `--fonts-academy-display|text|mono`, `--radii-academy-s|m|l`, `--durations-fast|base|slow`, `--easings-academy-out|standard`, `--spacing-academy-gutter`.

Review the resolved values in Storybook under `Design System/Tokens`, in both schemes.

## Using tokens

- In a design-system recipe, use the token name: `color: "academy.text"`.
- In a component-scoped `<style>`, use the generated variable: `color: var(--colors-academy-text)`.
- For a tint, mix the token: `color-mix(in srgb, var(--colors-academy-accent) 30%, transparent)`.
- Never copy a hex value into a component.

## Retired names

`--brand-*`, `--surface-*`, `--editorial-*`, `--text-*-content`, `--text-muted`, `--radius-*`, `--duration-*`, `--ease-*` and the `--font-instrument-serif|inter-tight|jetbrains-mono` variables were compatibility aliases onto the tokens above. Do not use them; when you touch a file that still does, replace each with the generated `academy` variable.

## Library API

`src/lib/theme.ts`:

- `getColorSchemePreference()`: the stored choice, `"light"`, `"dark"` or `"system"`.
- `getColorScheme()`: the scheme applied to the page, `"light"` or `"dark"`.
- `setColorScheme(preference)`: persists and applies a preference.
- `toggleColorScheme()`: cycles light, dark, system.
- `initTheme()`: applies the persisted preference and follows the OS setting while the preference is `"system"`.

`ThemeScript.astro` sits in `<head>` and applies the scheme before first paint. A `color-scheme-change` event fires on `window` when the applied scheme changes.

## Persistence

The preference is stored in `localStorage` under the key `rawkode-color-scheme` (`"light"`, `"dark"` or `"system"`).
