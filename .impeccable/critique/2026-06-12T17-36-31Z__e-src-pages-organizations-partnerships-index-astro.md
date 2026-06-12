---
target: partnerships sales page (/organizations/partnerships)
total_score: 22
p0_count: 1
p1_count: 3
timestamp: 2026-06-12T17-36-31Z
slug: e-src-pages-organizations-partnerships-index-astro
---
# Critique: /organizations/partnerships (primary sales page)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | CTA silently hands off to mail client, no on-page confirmation of next step |
| 2 | Match System / Real World | 1 | "Signal read", "sharper friction", "launch motions": buyer must translate the whole page |
| 3 | User Control and Freedom | 2 | mailto: is the only contact path; no form, calendar, or visible plain-text address |
| 4 | Consistency and Standards | 2 | Sells "Council"; the pages funneling here sell "Launch". Re-implements existing primitives |
| 5 | Error Prevention | 2 | 8-field pre-encoded mailto body breaks in corporate webmail; no recovery path |
| 6 | Recognition Rather Than Recall | 2 | "Everything in Signal/Adoption" forces cross-card recall; jargon never defined |
| 7 | Flexibility and Efficiency | 2 | No fast path for high-intent buyers (no call booking) |
| 8 | Aesthetic and Minimalist Design | 3 | Hairline/paper discipline is handsome; 8 identical section rhythms, 14 always-open bullets |
| 9 | Error Recovery | 2 | "Not a good fit" path handled well in copy; failed mailto is a dead end |
| 10 | Help and Documentation | 3 | 7-question FAQ with JSON-LD, explicit scope boundaries; strongest heuristic |
| **Total** | | **22/40** | **Acceptable: significant improvements needed** |

## Anti-Patterns Verdict

LLM assessment: reads AI-assembled. Eyebrow kicker on all 8 sections; three different numbered/labeled list devices; "Each month..." opens six sentences; abstract-noun counts: adoption ×35, proof ×20, signal ×19, narrative ×7, friction ×6; loop steps are the canonical AI triplet ("Read the signal. / Choose the friction. / Turn it into motion.").

Deterministic scan: 0 findings on the target file (exit 0). One warning on sibling organizations/index.astro:202 (side-tab: border-left 3px var(--editorial-red)), judged a plausible false positive (editorial list rule, not a card stripe). The detector's rules don't cover kicker-scaffolding or copy cadence, which is where this page actually fails.

Browser visualization: skipped, no browser automation available.

## Priority Issues

- [P0] Package naming contradicts the funnel: organizations/index.astro and lets-chat.astro sell "Launch" (£3k); this page sells "Council". Fix all three + organization-jsonld.astro.
- [P1] Zero social proof on a £12k–£36k/yr decision: no testimonial, logo, audience number, or named partner. Only vendor named is Teleport, by accident, in a course URL.
- [P1] mailto:-only conversion path, hostile at the moment of highest intent; lets-chat.astro (built to explain the email) is never linked from this page.
- [P1] Copy doesn't survive translation into buyer language; deliverables invisible ("a clearer signal read, sharper friction, and a practical next move").
- [P2] Page forks the design system: opts out of Instrument Serif italic ramp, uses unloaded font weights (730–780 vs loaded 300–700), re-implements EditorialButton/MLabel, wrong token fallbacks (hue 260 vs 60; opaque hairline), 118rem width vs 72rem siblings.

## Persona Red Flags

- Jordan (first-time marketing leader): page never establishes who Rawkode/David is; "Rawkode Live"/"Klustered" meaningless without reach numbers.
- Casey (mobile): five identical "Get in Touch" CTAs; package card puts CTA above the description in DOM order; 8-field email draft on a phone.
- Skeptical DevRel lead: "signal brief", "adoption map", "pattern notes" pattern-match to consultant-speak; cohort/expert claims unverifiable.

## Minor Observations

- "The Work Behind the Signal" is the only Title Case h2.
- Featured Adoption mailto is the only one missing the "Preferred partnership path" prefill.
- Two !important declarations; three near-duplicate inline mailto strings, already drifted.
- No link back to /organizations; page is a cul-de-sac.
- Clearest selling copy (how to choose a tier) is buried in a collapsed FAQ.

## Questions to Consider

1. If every sentence containing "signal", "friction", or "narrative" were deleted, would the buyer understand the offer better?
2. The page uses "proof" 20 times and offers none about itself. Would David email a vendor whose £2k/month pitch page had zero named customers and a mailto CTA?
3. Why is the strongest evidence (the Teleport course) hidden as a hyperlink instead of leading the proof section?
