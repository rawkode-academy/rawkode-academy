# Product

## Register

brand (marketing surfaces: `/`, `/join`, `/games/*`)
product (live surfaces: `/host/*`, `/play/*`, `/audience/*`, `/display/*`, `/admin/*`)

Rawkode Arcade is a two-register product. The public pages sell a show; the live
pages run one. Both draw from the same token set, but the live pages obey the
product register's rules (consistency over surprise, state-carrying motion only,
dense information) and the public pages obey the brand register's (one dominant
idea per fold, committed colour, deliberate pacing).

## Users

Three audiences, in one room, on three different screens.

**Operators** are Rawkode Academy staff running a live stream. They sit in a dark
gallery behind a laptop, cut between prompts under time pressure, and cannot
afford to hunt for a control. They sign in with their Academy account and need
an active Arcade operator role.

**Contestants and audience** are the same cloud-native engineers the Academy
already serves. They play on a phone, one-handed, as a second screen next to the
stream, often on poor conference wifi. They arrive with a six-character code and
no account.

**Viewers** never touch the product. They see it only as a video frame: the
broadcast display route, composited into the stream, read at 1-3 metres on a
laptop or across a room on a TV, frequently downscaled to 720p and sometimes
keyed behind a lower third.

## Product Purpose

Rawkode Arcade turns the Academy's technical material into live competitive
formats: six developer game shows with authoritative rooms, audience
participation, and verifiable results.

Success means an operator can open a room and run a show without rehearsal, a
player on a phone can answer inside the window without pinching to zoom, and a
viewer can read the score off the stream without being told what it is.

## Brand Personality

Practical, candid, technically rigorous, and now on a clock.

Arcade inherits the Academy's voice (a strong engineering field journal:
specific, earned, direct) and adds the one thing a journal does not have: it is
happening right now, and it is being watched. The register is a television
production gallery, not an arcade cabinet. Nothing here is retro-gaming pastiche,
neon cyberpunk, or esports gloss.

## Anti-references

Do not make Arcade feel like a generic SaaS landing page, an esports team site, a
retro-arcade tribute, or a crypto product. Specifically banned, because the first
implementation shipped all of them:

- Neon cyan on cold navy. The whole `#4de8ff`-on-`#080d1d` family.
- A per-format rainbow. Six games do not need six hues; a format is not a state.
- Tiny uppercase tracked mono eyebrows above every section.
- Glassmorphic gradient cards, rotated "product mockup" panels, large soft
  drop shadows, and 20px pill radii.
- The hero metric row (big number, small label, three across).
- Identical card grids as the answer to every list.
- Copy in the shape "Plain clause, *accent-coloured second clause.*"

Arcade must not read as a separate company from rawkode.academy. A visitor
arriving from the main site should recognise the type, the rules, and the
accents before they read a word.

## Design Principles

1. **The stream is a viewport.** Every live surface is designed for the distance
   it is read at. A phone at 40cm and a stream frame at 3m do not share a type
   scale, and pretending they do is the product's single biggest failure mode.
2. **State is the only reason for colour.** Amber means live. Spruce means
   selected or actionable. Rust means wrong, eliminated, or over. Colour that
   marks nothing is decoration, and decoration is banned (the Academy's Evidence
   Accent Rule, inherited verbatim).
3. **Numbers are the imagery.** Scores, codes, timers, and standings are the
   visual content of a game show. Set them large, in mono, with tabular figures,
   and let them carry the page instead of illustration.
4. **A running order, not a card grid.** Formats, rounds, standings, and queues
   are sequences. Show them as ruled sequences. Reach for a card only when the
   thing genuinely is a discrete object.
5. **Legible under compression.** The display route is re-encoded before anyone
   sees it. Hairline rules, low-contrast muted text, and sub-pixel detail do not
   survive 720p. Design for the worst frame, not the design file.

## Accessibility & Inclusion

WCAG AA is the floor and is enforced in CI, not by review: `src/tests/design-
tokens.test.ts` computes contrast from the token values and fails the build on
any foreground/background pair below 4.5:1, and on any type token below 14px.

Colour is never the only carrier of state; every accent is paired with a text
label, a glyph, or a rule weight. The audience and contestant paths must stay
operable one-handed at 320px with a 44px minimum touch target. Motion respects
`prefers-reduced-motion`, and no content is gated behind a reveal transition.
`prefers-contrast: more` promotes every hairline to a solid rule and lifts muted
text to full ink, and unlike the first implementation the selectors it targets
actually exist.
