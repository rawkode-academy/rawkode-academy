---
name: Rawkode Academy Website
description: Practitioner-led cloud-native education with a modern technical-publication visual system.
colors:
  editorial-paper: "oklch(0.97 0.008 85)"
  editorial-paper-deep: "oklch(0.93 0.012 85)"
  editorial-ink: "oklch(0.18 0.02 60)"
  editorial-ink-soft: "oklch(0.36 0.015 60)"
  editorial-ink-mute: "oklch(0.51 0.012 60)"
  editorial-spruce: "oklch(0.50 0.09 165)"
  editorial-amber: "oklch(0.72 0.15 65)"
  editorial-amber-text: "oklch(0.52 0.13 65)"
  editorial-rust: "oklch(0.52 0.13 40)"
  editorial-violet: "oklch(0.50 0.13 290)"
  dark-base: "oklch(0.14 0.01 280)"
  dark-surface: "oklch(0.26 0.014 280)"
typography:
  display:
    fontFamily: "Instrument Serif, Iowan Old Style, Georgia, serif"
    fontSize: "clamp(3rem, 7vw, 6rem)"
    fontWeight: 400
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter Tight, Inter, -apple-system, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.4rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Tight, Inter, -apple-system, system-ui, sans-serif"
    fontSize: "1.65rem"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "0"
  body:
    fontFamily: "Inter Tight, Inter, -apple-system, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "0"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.7rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.14em"
rounded:
  xs: "2px"
  sm: "2px"
  md: "3px"
  lg: "3px"
  xl: "4px"
  2xl: "4px"
  3xl: "6px"
  4xl: "8px"
spacing:
  page-sm: "clamp(1rem, 3vw, 1.75rem)"
  page: "clamp(1.5rem, 4vw, 3rem)"
  page-lg: "clamp(2rem, 5vw, 4rem)"
  section-tight: "clamp(2rem, 5vw, 3.75rem)"
  section: "clamp(3rem, 6vw, 5rem)"
  section-relaxed: "clamp(4rem, 7vw, 6rem)"
  stack-sm: "clamp(1rem, 3vw, 1.75rem)"
  stack: "clamp(1.5rem, 3.5vw, 2.5rem)"
  stack-lg: "clamp(2rem, 4.5vw, 3.25rem)"
  card: "clamp(1.25rem, 3vw, 2.25rem)"
  card-lg: "clamp(1.75rem, 4vw, 2.75rem)"
components:
  button-primary:
    backgroundColor: "{colors.editorial-ink}"
    textColor: "{colors.editorial-paper}"
    rounded: "{rounded.xl}"
    padding: "0.8rem 1.1rem"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.xl}"
    padding: "0.8rem 1.1rem"
    height: "2.75rem"
  card-editorial:
    backgroundColor: "{colors.editorial-paper-deep}"
    textColor: "{colors.editorial-ink}"
    rounded: "{rounded.3xl}"
    padding: "1.2rem"
  label-mono:
    textColor: "{colors.editorial-spruce}"
    typography: "{typography.label}"
---

# Design System: Rawkode Academy Website

## 1. Overview

**Creative North Star: "The Technical Publication for Practitioners"**

Rawkode Academy uses a modern publication system for practical technical learning: wide media and reading canvases, decisive hierarchy, paper-like surfaces, sharp rules, and a small set of evidence-led accents. The system should feel like the technical publication developers keep open while they work, not a generic developer landing page or a themed documentation portal.

Instrument Serif is reserved for one defining display moment per page. Inter Tight carries navigation, section hierarchy, dense readable UI, and prose. JetBrains Mono is limited to metadata, labels, schedules, and technical identifiers. The site can be content-heavy, but every page must make the next useful artifact obvious without burying decisions in decorative cards.

The system rejects slideware polish, broad SaaS gradients, paid-media gloss, fake simplicity, and open-ended consulting posture. Commercial pages should feel as specific and bounded as technical pages.

**Key Characteristics:**

- Paper and ink surfaces with spruce, amber, rust, and violet accents.
- Sharp editorial radii from 2px to 8px, not soft rounded cards.
- Hairline borders and tonal layering before shadows.
- Wide, scan-friendly layouts with deliberate section rhythm.
- Copy that names real technical work, tradeoffs, and boundaries.
- A compact publication masthead and full navigation drawer instead of a persistent application sidebar.

## 2. Colors

The palette is an editorial paper and ink system with restrained practitioner accents.

### Primary

- **Spruce Signal** (`oklch(0.50 0.09 165)`): Primary action accent for links, labels, active states, and selected system moments.

### Secondary

- **Amber Live** (`oklch(0.72 0.15 65)`): Time-sensitive states such as live, upcoming, warning, and attention cues.
- **Rust Proof** (`oklch(0.52 0.13 40)`): Editorial emphasis, strong inline accent, and grounded commercial details.

### Tertiary

- **Violet Edge** (`oklch(0.50 0.13 290)`): Rare contrast accent for special states or visual variety. Use sparingly.

### Neutral

- **Paper** (`oklch(0.97 0.008 85)`): Default light surface.
- **Deep Paper** (`oklch(0.93 0.012 85)`): Cards, secondary panels, and slight separation.
- **Ink** (`oklch(0.18 0.02 60)`): Primary text and strong borders.
- **Soft Ink** (`oklch(0.36 0.015 60)`): Body ledes, secondary descriptions, and lower hierarchy text.
- **Muted Ink** (`oklch(0.51 0.012 60)`): Metadata only, never long body copy if contrast weakens.
- **Dark Base** (`oklch(0.14 0.01 280)`): Dark-mode page ground.
- **Dark Surface** (`oklch(0.26 0.014 280)`): Dark-mode cards and panels.

### Named Rules

**The Evidence Accent Rule.** Accent color marks a real state, category, or decision. Do not use accent color as decorative filler.

**The Paper Rule.** Light pages should feel like a working technical journal. Keep the surface quiet, but do not wash text out into low-contrast gray.

## 3. Typography

**Display Font:** Instrument Serif, with Iowan Old Style, Georgia, serif fallback.
**Body Font:** Inter Tight, with Inter, -apple-system, system-ui, sans-serif fallback.
**Label/Mono Font:** JetBrains Mono, with ui-monospace, SFMono-Regular, Menlo, monospace fallback.

**Character:** The pairing is editorial and technical: serif display gives publication weight, Inter Tight keeps dense surfaces efficient, and JetBrains Mono carries metadata without pretending every element is a terminal.

### Hierarchy

- **Display** (400, `clamp(3rem, 7vw, 6rem)`, `1.02`): Hero and masthead statements. Use italic serif selectively, not on every heading.
- **Headline** (500, `clamp(2rem, 4vw, 3.4rem)`, `1.02`): Major section statements and landing-page claims.
- **Title** (700 to 750, `1.05rem` to `1.65rem`, `1` to `1.2`): Cards, modules, and grouped content headings.
- **Body** (400, `1rem`, `1.55`): Prose, ledes, and explanatory UI copy. Keep long-form line length near 65 to 75 characters.
- **Label** (600, `0.7rem`, `0.14em`, uppercase): Metadata, schedule labels, filters, and small status tags.

### Named Rules

**The Display Scarcity Rule.** Large serif type is a signal. Use it once for the defining page statement; use sans-serif hierarchy for sections and long-form reading.

**The Metadata Rule.** Mono labels must describe concrete metadata or state. Avoid using mono as generic developer costume.

## 4. Elevation

The default elevation model is flat and structural. Light-mode surfaces rely on hairline borders, paper depth, and layout separation. Shadow tokens exist mostly as one-pixel rings in light mode. Dark mode uses deeper shadows when needed to keep panels separated from the ink-dark ground.

### Shadow Vocabulary

- **Ring Low** (`0 0 0 1px oklch(0.18 0.02 60 / 0.06)`): Subtle light-mode separation.
- **Ring Medium** (`0 0 0 1px oklch(0.18 0.02 60 / 0.10)`): Card or panel separation when a simple border is too quiet.
- **Dark Low** (`0 2px 6px rgba(0, 0, 0, 0.4)`): Dark-mode low elevation.
- **Dark Medium** (`0 8px 24px rgba(0, 0, 0, 0.5)`): Dark-mode active or floating surfaces.

### Named Rules

**The Flat-By-Default Rule.** Borders and tonal shifts come before drop shadows. Shadows should clarify state or dark-mode layering, not decorate.

## 5. Components

### Buttons

- **Shape:** Sharp editorial rectangle, 4px radius.
- **Primary:** Ink background with paper text, mono uppercase label, minimum height `2.75rem`, padding `0.8rem 1.1rem`.
- **Hover / Focus:** Hover can move to Spruce Signal. Focus must use a visible 2px outline in the brand accent with offset.
- **Secondary:** Transparent surface with ink text and hairline border. Hover uses deep paper and stronger ink border.

### Chips

- **Style:** Mono or compact sans labels with hairline borders, paper or dim accent backgrounds, and clear contrast.
- **State:** Selected states should be visible through border, background, and text weight, not color alone.

### Cards / Containers

- **Corner Style:** 6px default editorial card radius.
- **Background:** Deep Paper in light mode, Dark Surface in dark mode.
- **Shadow Strategy:** Flat by default. Prefer border and surface contrast.
- **Border:** One-pixel editorial hairline.
- **Internal Padding:** Use `1.2rem` for compact cards, `var(--space-card-pad)` and `var(--space-card-pad-lg)` for larger surfaces.

### Inputs / Fields

- **Style:** Use paper or deep paper backgrounds, 1px hairline borders, compact radius, and body font.
- **Focus:** Use visible outline or border shift with sufficient contrast.
- **Error / Disabled:** Pair color with text, icon, or explicit copy. Do not rely on red or muted color alone.

### Navigation

Navigation uses a compact sticky publication masthead with direct links to the primary learning formats, a search trigger, and an accessible full navigation drawer. Do not reintroduce a persistent desktop sidebar. Mobile navigation must preserve access to every collection while keeping the masthead controls within a 320px viewport.

### Layout Contracts

- **Prose** (`--layout-prose`): articles, policies, ADR bodies, and focused utility copy.
- **Content** (`--layout-content`): detail pages, curricula, search, and collection results.
- **Wide** (`--layout-wide`): video, technology matrix, landing features, and dense comparison surfaces.
- Page families assemble `PageMasthead`, `CollectionToolbar`, `ContentCard`, and `DetailFrame` before introducing route-local layout CSS.

### Editorial Shell

The editorial shell is the signature layout for about and commercial surfaces: masthead, ruled sections, split grids, mono kickers, dense cards, and clear action rows. Keep it structured and asymmetric enough to feel authored.

## 6. Do's and Don'ts

### Do:

- **Do** use `src/styles/global.css` and `uno.config.ts` tokens before adding new one-off values.
- **Do** keep body and lede text at strong contrast against Paper and Dark Base.
- **Do** use Spruce Signal, Amber Live, and Rust Proof for meaningful states and emphasis.
- **Do** keep cards sharp: 6px is the normal editorial card radius, 8px is the upper bound for large framed tools.
- **Do** write commercial copy as bounded adoption help with clear exclusions.
- **Do** keep critical content server-rendered and usable without JavaScript.

### Don't:

- **Don't** make the site feel like slideware, a generic SaaS landing page, a paid-media publication, or a content farm.
- **Don't** frame partnerships as outsourced DevRel, open-ended consulting retainers, lead generation, guaranteed coverage, or editorial placement.
- **Don't** use gradient text, glassmorphism, broad purple-blue gradients, oversized rounded cards, or decorative soft shadows.
- **Don't** repeat tiny uppercase eyebrows above every section unless the section genuinely needs metadata.
- **Don't** introduce a new route-local masthead, filter bar, card anatomy, or content-width value when a publication contract covers it.
- **Don't** use mono labels when the text is not metadata, state, or a technical identifier.
- **Don't** let muted text carry long body copy on tinted surfaces if contrast falls below WCAG AA.
