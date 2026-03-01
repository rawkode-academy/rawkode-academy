# Design System

## Source of truth

- Theme and foundational tokens: [`src/styles/global.css`](../src/styles/global.css)
- Reusable UI class primitives: [`src/lib/ui-classes.ts`](../src/lib/ui-classes.ts)

## Design tokens

### Color/theme tokens
Defined in `:root` and `.dark` with Tailwind `@theme` mappings:
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--popover`, `--popover-foreground`
- `--primary`, `--primary-foreground`
- `--secondary`, `--secondary-foreground`
- `--muted`, `--muted-foreground`
- `--accent`, `--accent-foreground`
- `--destructive`, `--destructive-foreground`
- `--border`, `--input`, `--ring`

Category tone tokens:
- `--tone-news`
- `--tone-ask`
- `--tone-show`
- `--tone-rka`

### Control sizing tokens
- `--rkn-control-sm-height`
- `--rkn-control-md-height`
- `--rkn-control-lg-height`
- `--rkn-control-inline-padding`

### Typography tokens
- `--font-display-family`
- `--font-body-family`
- `--font-mono-family`

## Shared class primitives (`src/lib/ui-classes.ts`)

### Interaction foundations
- `interactiveControlClass`: standard control transitions, active feedback, focus ring
- `interactiveTextClass`: text-link transition + focus ring
- `interactiveTextActionClass`: text actions with active feedback

### Form controls
- `inputClass`
- `textareaClass`
- `selectPrimarySmClass`

### Buttons and controls
- `buttonPrimarySmClass`, `buttonPrimaryMdClass`, `buttonPrimaryLgClass`
- `buttonSecondarySmClass`, `buttonDestructiveSmClass`, `buttonGhostSmClass`
- `paginationControlClass`
- `menuPanelItemClass`
- `shellNavItemSmClass`, `shellNavStrongItemSmClass`

### Text actions/links
- `textLinkMutedXsClass`
- `textActionMutedXsClass`
- `textActionMutedXsStrongClass`
- `textActionMutedXsUnderlineClass`
- `inlineBackLinkSmClass`
- `inlinePrimaryLinkClass`

### Tag/pill patterns
- `tagChipBaseClass`
- `tagFilterChipClass`
- `tagFilterChipSelectedClass`
- `tagRemovalControlClass`
- `checkboxPillSmClass`

Semantic category tone classes (from `src/styles/global.css`):
- `rkn-tag-tone-news[-soft]`
- `rkn-tag-tone-ask[-soft]`
- `rkn-tag-tone-show[-soft]`
- `rkn-tag-tone-rka[-soft]`

View/header classes (from `src/styles/global.css`):
- `rkn-view-header`
- `rkn-nav-tab-active`
- `rkn-brand-block`

## Extraction + consolidation completed

The following areas were migrated from repeated one-off class strings to shared primitives:
- `src/components/layout/AppShell.astro`
- `src/components/post/CommentBranch.svelte`
- `src/components/post/CommentTree.astro`
- `src/components/feed/TagFilterGrid.astro`
- `src/components/common/Pagination.astro`
- `src/pages/item/[id].astro`
- `src/pages/submit.astro`

## Rules for future UI work

1. Prefer existing exports from `src/lib/ui-classes.ts` before introducing new inline class strings.
2. Use control sizing tokens (`--rkn-control-*`) instead of hard-coded heights/padding.
3. Use semantic color utilities (`bg-primary`, `text-muted-foreground`, etc.) backed by theme tokens.
4. If a new pattern appears in 3+ places, extract it into `src/lib/ui-classes.ts`.
5. Keep variants semantic (purpose-based names), not page-specific names.
