# Layout & Spacing System

We now expose a small set of semantic spacing tokens through Tailwind so every page can share the same rhythm. The tokens live in `src/styles/global.css` and power a series of utility classes that remove the need for ad‑hoc `px-4 md:px-8` stacks.

## Tokens

| Token | CSS Variable | Default Value (clamp) | Intended Use |
| --- | --- | --- | --- |
| `--spacing-page-sm`, `--spacing-page`, `--spacing-page-lg` | `--space-page-sm`, etc. | `clamp(1rem, 3vw, 1.75rem)` … `clamp(2rem, 5vw, 4rem)` | Horizontal gutters for the whole page or section containers |
| `--spacing-section-tight`, `--spacing-section`, `--spacing-section-relaxed` | `--space-section-*` | `clamp(2rem, 5vw, 3.75rem)` … `clamp(4rem, 7vw, 6rem)` | Vertical padding applied to major sections |
| `--spacing-stack-sm`, `--spacing-stack`, `--spacing-stack-lg` | `--space-stack-*` | `clamp(1rem, 3vw, 1.75rem)` … `clamp(2rem, 4.5vw, 3.25rem)` | Gaps between stacked blocks (flex/grid) |
| `--spacing-card`, `--spacing-card-lg` | `--space-card-pad*` | `clamp(1.25rem, 3vw, 2.25rem)` / `clamp(1.75rem, 4vw, 2.75rem)` | Interior padding for cards, hero shells, and feature panels |

Because the values are defined with `clamp`, they shrink on smaller screens without custom breakpoints.

## Utility classes

Add these classes anywhere you previously sprinkled responsive Tailwind paddings:

- `page-px-sm`, `page-px`, `page-px-lg` → `padding-inline`
- `section-py-tight`, `section-py`, `section-py-relaxed` → `padding-block`
- `stack-gap-sm`, `stack-gap`, `stack-gap-lg` → `gap`
- `card-padding`, `card-padding-lg` → uniform inner padding for cards or hero shells

Example:

```astro
<section class="section-py page-px max-w-6xl mx-auto">
  <div class="glass-panel card-padding-lg stack-gap">
    ...
  </div>
</section>
```

## Adoption guidelines

1. Prefer these semantic utilities for all page shells, sections, and cards before falling back to raw Tailwind spacing classes.
2. `page-px` should sit on `main`, major sections, or any `max-w` wrapper to keep gutters consistent.
3. `section-py-tight` works best for stacked sections on the same page (e.g., hero + list). Use `section-py` or `section-py-relaxed` for larger breathing room.
4. Use `stack-gap` on wrapper flex/grid containers instead of `gap-8`, `gap-12`, etc., so vertical rhythm stays predictable.
5. For card-like layouts (Featured blocks, technology cards, etc.) wrap contents in `.card-padding` or `.card-padding-lg` rather than mixing `p-6 sm:p-10`.

When a new layout requires a different rhythm, add a new token/utility in `global.css` so the vocabulary stays shared.
