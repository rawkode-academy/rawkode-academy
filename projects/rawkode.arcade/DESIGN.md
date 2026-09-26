---
name: Rawkode Arcade
description: The Rawkode Academy technical publication, running live in a broadcast gallery.
colors:
  ground: "oklch(0.14 0.01 280)"
  surface: "oklch(0.22 0.012 280)"
  surfaceRaised: "oklch(0.26 0.014 280)"
  ink: "oklch(0.92 0.008 85)"
  inkSoft: "oklch(0.74 0.008 85)"
  inkMute: "oklch(0.66 0.008 85)"
  rule: "oklch(1 0 0 / 0.10)"
  ruleStrong: "oklch(1 0 0 / 0.18)"
  spruce: "oklch(0.72 0.09 165)"
  amber: "oklch(0.72 0.15 65)"
  rust: "oklch(0.70 0.12 40)"
  violet: "oklch(0.70 0.13 290)"
typography:
  display:
    fontFamily: "Instrument Serif, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.75rem, 6vw, 5.5rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 3.5vw, 3rem)"
    fontWeight: 500
    lineHeight: 1.04
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  bodySm:
    fontFamily: "Inter Tight, Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.12em"
  tally:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.03em"
    fontVariantNumeric: "tabular-nums"
rounded:
  none: "0"
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
spacing:
  page-sm: "clamp(1rem, 3vw, 1.75rem)"
  page: "clamp(1.5rem, 4vw, 3rem)"
  section-tight: "clamp(2rem, 5vw, 3.75rem)"
  section: "clamp(3rem, 6vw, 5rem)"
  section-relaxed: "clamp(4rem, 7vw, 6rem)"
  stack-sm: "clamp(1rem, 3vw, 1.75rem)"
  stack: "clamp(1.5rem, 3.5vw, 2.5rem)"
  card: "clamp(1.25rem, 3vw, 2.25rem)"
components:
  control-primary:
    backgroundColor: "{colors.spruce}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    typography: "{typography.label}"
    height: "2.75rem"
  control-live:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.ground}"
    rounded: "{rounded.md}"
    typography: "{typography.label}"
    height: "2.75rem"
  stage:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    border: "1px solid {colors.rule}"
  slug:
    textColor: "{colors.inkSoft}"
    typography: "{typography.label}"
---

# Design System: Rawkode Arcade

## 1. Overview

**Creative North Star: "The Technical Publication, Live From The Gallery."**

Arcade is not a second brand. It is the Rawkode Academy publication system moved
into a television production gallery: the same Instrument Serif display, the same
Inter Tight hierarchy, the same JetBrains Mono metadata, the same sharp 2-8px
radii and hairline rules. What changes is the room. The gallery is dark, the
clock is running, and everything on screen is either a state or a number.

The Academy already contains the bridge. Its `--terminal-*` tokens describe a
theme-invariant dark "screen within the page", and its Amber Live accent is
already defined as the colour of *live, upcoming, warning, attention*. Arcade is
that surface at full-page scale, permanently in that state. Nothing was invented
to get here.

**Key characteristics:**

- Ink-dark ground with two panel tiers, lifted directly from the Academy's
  dark mode.
- Four accents, no more: Amber Live, Spruce Signal, Rust Proof, Violet Edge.
  Formats are **not** colour-coded.
- Rules do the structural work. Hairline for grouping, 2px for section heads,
  full-bleed for the on-air bar.
- Scores, codes and timers set large in tabular mono. The numbers are the art.
- Sequences render as running orders, not card grids.
- Two type scales: one for hand-held and desk, a separate one for the broadcast
  frame.

## 2. Colours

Inherited wholesale from the Academy's dark mode. Values are the Academy's
own dark-mode ramp, not re-derived.

### Ground

- **Ground** (`oklch(0.14 0.01 280)`): page ground. The Academy's `--surface-base`
  in dark mode.
- **Surface** (`oklch(0.22 0.012 280)`): panels, stages, fields.
- **Surface Raised** (`oklch(0.26 0.014 280)`): the one tier above, for a panel
  inside a panel. There is no third tier; if you need one, the layout is wrong.

### Ink

- **Ink** (`oklch(0.92 0.008 85)`): primary text.
- **Ink Soft** (`oklch(0.74 0.008 85)`): ledes, secondary description.
- **Ink Mute** (`oklch(0.66 0.008 85)`): metadata only. This is the lowest tone
  permitted on any surface and it is verified in CI against both Ground and
  Surface Raised.

There is no tone below Ink Mute. The previous implementation's `#aebbd9`
at 9px is exactly what this rule exists to prevent.

### Accents

- **Amber Live** (`oklch(0.72 0.15 65)`): the Arcade signature. On air, running,
  open, counting down, your turn. Because Arcade is a live product, amber appears
  more here than anywhere on the Academy site, and that is the point.
- **Spruce Signal** (`oklch(0.72 0.09 165)`): primary action, selection, link,
  correct, connected.
- **Rust Proof** (`oklch(0.70 0.12 40)`): wrong, eliminated, disconnected, closed.
- **Violet Edge** (`oklch(0.70 0.13 290)`): rare. Audience-aggregate figures
  only, to separate the crowd from the contestants.

### Named Rules

**The Evidence Accent Rule** (inherited). Accent marks a real state, category or
decision. Never decoration.

**The Format Is Not A State Rule.** Games are distinguished by name, glyph and
running-order position, never by hue. A six-colour format palette is the thing
that made the first implementation look generated, and re-adding it is a
regression, not a feature.

**The Compression Rule.** Anything that must survive the stream encoder uses a
minimum 2px rule weight and a minimum 7:1 contrast ratio. Hairlines are for
surfaces a human looks at directly.

## 3. Typography

Academy trio, unchanged: **Instrument Serif** (display), **Inter Tight** (body
and UI), **JetBrains Mono** (metadata and numerals). Loaded through Astro's
`fonts` API with `fontProviders.google()`, which self-hosts and subsets at build
time. There is no runtime request to a third party.

### Hierarchy

Seven steps. Any size not on this list does not exist.

| Step | Family | Size | Use |
|---|---|---|---|
| `display` | Instrument Serif | `clamp(2.75rem, 6vw, 5.5rem)` | One statement per page |
| `headline` | Inter Tight 500 | `clamp(1.75rem, 3.5vw, 3rem)` | Section statements |
| `title` | Inter Tight 700 | `1.25rem` | Panel and group headings |
| `body` | Inter Tight 400 | `1rem` | Prose, ledes |
| `bodySm` | Inter Tight 400 | `0.875rem` | Dense UI. **Floor for any prose.** |
| `label` | JetBrains Mono 600 | `0.75rem`, `0.12em`, caps | Metadata and state |
| `tally` | JetBrains Mono 600 | `clamp(2rem, 4vw, 3.25rem)` | Scores, codes, timers |

### Named Rules

**The Display Scarcity Rule** (inherited). One serif moment per page. Section
headings are Inter Tight, not serif.

**The Metadata Rule** (inherited). Mono is for metadata, state, and technical
identifiers. Never for prose, never as developer costume.

**The 14px Floor.** No text token below `0.875rem`, and `label` at `0.75rem` is
permitted only for genuine metadata, never for a sentence. Enforced in CI.

**The Tabular Rule.** Every number that changes while someone is watching it uses
`font-variant-numeric: tabular-nums`. A score that reflows as it counts is a bug.

## 4. The Broadcast Scale

`/display/[code]` is a separate design problem and gets a separate scale. It is
read at 1-3 metres, re-encoded to 720p, and sometimes keyed. It does not share
components with the phone UI.

- Base unit is `vmin`, not `rem`. Nothing scales with the browser's root size,
  because the browser is a video source.
- Minimum type on the display route: `2.2vmin`. Scores run `9vmin` to `16vmin`.
- Safe area: `4vmin` inset on all edges, plus a `14vmin` bottom exclusion zone
  kept clear for the stream's lower third.
- Rules are `2px` minimum, never hairline.
- Only two tones of text: Ink and Amber. Ink Soft and Ink Mute do not survive
  the encoder.

## 5. Elevation

Flat and structural, inherited from the Academy. Borders and tonal shifts before
shadows. Dark-mode shadows exist only to separate a floating surface from the
ground, and only at the Academy's `--shadow-md` weight
(`0 8px 24px rgba(0,0,0,0.5)`). The previous `0 22px 80px rgb(0 0 0 / 35%)` is
banned: it is decoration, and at that spread it is invisible anyway.

## 6. Components

### Rules and slugs

The signature structural device. A section opens with a 2px rule carrying an
inline slug: a mono label plus, where it exists, a real technical identifier
(`FMT-03`, `ROOM SHIPIT`, `R2 · Q4`). This replaces the banned eyebrow. The
distinction is strict: a slug carries metadata, an eyebrow carries a category
name. `TONIGHT'S FORMATS` is an eyebrow and is not allowed. `FMT-03 · 4 TEAMS`
is a slug and is.

### Running order

Ruled rows, one per item, with a mono index, a title in Inter Tight, optional
metadata, and a single trailing affordance. This is the default presentation for
formats, rounds, standings, players, and queues. It replaces card grids.

### Stage

The one container primitive: Surface background, hairline border, `6px` radius,
`card` padding. Variants for `raised`, `live` (amber rule), and `flush` (no
border, for nesting inside a stage). Nested stages are not permitted beyond one
level.

### Controls

- **Primary**: Spruce background, Ground text, mono uppercase label, `4px`
  radius, `2.75rem` minimum height, `44px` minimum touch target.
- **Live**: Amber background. Reserved for actions that change broadcast state
  (open room, advance round, reveal answer). Never used for navigation.
- **Quiet**: transparent, hairline border, Ink text.
- **Danger**: Rust border and text. Never a filled rust button.

Every control ships default, hover, focus-visible, active, disabled and loading.

### Fields

Ground background inside a Surface panel, hairline border, `3px` radius, Inter
Tight at `body`. Focus lifts the border to Spruce plus a 2px offset outline.
The room-code field is the one exception: `tally` scale, mono, tracked, uppercased
by transform with the underlying value untouched.

### Scoreboard

Tabular mono, rank in Ink Mute, name in Ink, score in `tally`. Leading position
is marked by a 2px amber left rule **and** a `LEAD` label, never colour alone.

## 7. Motion

Product register on live surfaces: 150-250ms, state-carrying only. Brand register
on the landing: one orchestrated first-load, nothing on scroll.

Easing is `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for entrances and
`cubic-bezier(0.4, 0, 0.2, 1)` for state changes. No bounce, no elastic.

Score changes animate the value, not the layout. Countdown uses a
`@property`-registered angle so the ring animates on the compositor.

`prefers-reduced-motion: reduce` replaces every transition with an instant state
change and every entrance with a crossfade. No content is gated behind a reveal.

## 8. Do's and Don'ts

### Do

- **Do** author every style through Panda: `css()`, `cva()`, `sva()`. There is no
  second way, and CI enforces it.
- **Do** add a token before adding a value. If the value is not worth a token, it
  is not worth shipping.
- **Do** pair every accent with a label, glyph or rule weight.
- **Do** design the display route at its real viewing distance.

### Don't

- **Don't** write a `<style>` block in `.astro` or `.vue`. Panda cannot see them;
  this is the bypass the whole system exists to close. CI fails the build.
- **Don't** write `var(--…)`, a hex literal, or a bare `px`/`rem` value in `src/`.
- **Don't** colour-code the six formats.
- **Don't** reintroduce eyebrows, glassmorphism, soft shadows, pill radii,
  rotated mockups, or the hero metric row.
- **Don't** use mono for prose.
- **Don't** let a runtime value carry a raw colour. Store the token name.
