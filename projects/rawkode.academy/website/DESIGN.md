# Rawkode Academy design system

The implementation source of truth is `packages/design-system/panda.config.ts`
and its Academy recipes. This document describes the PR #1355 direction; it is
not a claim that every existing page has passed the design audit.

## Direction

An authored technical publication for people who build and operate systems.
Use real lessons, real people, real project identities, and direct language.
Visual distinction comes from composition, decisive typography, and the work
itself—not decorative dashboards or invented metadata.

Every element must help a reader orient, discover, learn, act, or understand a
real state. Remove repeated CTAs, empty frames, ornamental labels, placeholder
controls, and duplicate recommendations.

## Foundations

- Red Hat Display: titles and section hierarchy, usually bold.
- Red Hat Text: navigation, descriptions, forms, and reading.
- Red Hat Mono: technical identifiers and concise metadata.
- Fonts resolve through Astro's generated CSS variables, not hardcoded family
  names. Historical font variables alias the same three Academy families.
- Cool light canvas (`#f4f7fb`), navy text (`#0c1626`), pink action accent
  (`#c2185b`). Dark mode uses navy canvas, light text, and brighter pink.
  Use semantic tokens rather than copying these values into components.
- Status colors communicate actual status. A topic or decorative eyebrow is
  not a success, warning, or live state.
- Borders include their semantic color. Hairlines must not default to text color.
- Flat surfaces and modest 3–6px radii. Reserve shadows for floating layers.

## Composition

The 1180px shell includes responsive 20–48px gutters; usable desktop content is
1084px. Header, page content, and footer align to this grid. Focused reading
surfaces target 680px of text. Dense technical diagrams and video may be wider.

Use space and rules before boxes. Cards earn a frame when they are independent
linked items or contain an interactive task. Do not wrap a whole reading page
in a card or put cards inside redundant cards.

Directory pages explain the collection and show real choices. Filters have
labels, real results, and an empty state. A decorative tab or fake pagination
label is not acceptable. Keep critical content server-rendered.

Detail pages prioritize the lesson, article, profile, or project. A course
exposes its curriculum promptly; a long article provides mobile contents
navigation; a show exposes its episodes before its subscription prompt.
Secondary metadata is compact and shown once.

## Imagery

Use available content artwork and genuine photography. Preserve logos' aspect
ratios. Missing people or project artwork uses honest initials, not the Academy
logo presented as someone else's identity.

News has generic section artwork; do not imply it depicts the particular story.
No artificial first-letter image tiles, empty media placeholders, or stock
imagery added merely to fill space.

## Interaction and access

Use Ark primitives for complex Vue interactions and native controls where they
serve the task. Mobile modal drawers trap focus, support Escape, and restore
focus. Closed controls must be hidden/inert, not merely offscreen.

Controls have visible labels, keyboard focus, adequate contrast, and generous
hit areas. Error/loading/success states are explicit and announced at the
appropriate scope. Avoid announcing an entire transcript on every search.

Never imply a real subscription, booking, saved preference, or successful
request without confirmation from the actual operation. Browser reviews must
not submit real user data or mutate accounts for the sake of screenshots.

## Verification

The audit artifacts in `docs/design-*.{md,json}` distinguish source analysis,
composition investigations, whole-page visual reviews, and deployment evidence.
Review the full page at mobile and desktop sizes, then relevant dark, keyboard,
empty, loading, error, and interaction states. Template samples do not establish
that every concrete URL passed.

Commercial facts, terms, boundaries, and legal wording must stay truthful.
Preserve useful content and do not invent proof, testimonials, or performance
claims to make a layout look more impressive.
