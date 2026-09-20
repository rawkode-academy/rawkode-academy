# Legacy utility coverage audit

Snapshot: 2026-09-20 UTC, working tree based on `e5280286`. Source inspection only; concurrent work may supersede line numbers. No Browser, installs, submissions, source changes, build, Astro sync, or test-suite execution. This report is the only file written by this audit.

## Decision

Bounded implementation follow-up (2026-09-20): `RelatedVideos.astro`, `AuthorAvatarGroup.vue`, `TopicHub.astro`, and `Container.vue` now use dedicated Academy recipes instead of the missing selectors identified below. Duration labels are anchored and omit unknown runtimes; avatar overlap is explicit with activity off by default; news rows have semantic rules; Container defines all six width variants. TopicHub also keeps video titles visible and supports Astro technology references. The original inventory/counts below remain a historical snapshot, not a fresh assertion about the current tree. Verification: 20 Vue/recipe tests, six Astro SSR fixture tests, scoped Vue diagnostics and strict recipe type checks passed. No Browser verification or shared CSS regeneration was performed by this owner.

Integration follow-up: regenerate Panda CSS for `academyRelatedContent`, `academyAuthorGroup`, and `academyContainer`. The technology page's separate `hasTopicContent` guard must mirror TopicHub's string-or-`{ id }` normalization so reference-only article matches are not hidden upstream. Container `xl` uses the 1180px Academy shell; `padding="lg"` uses the shared responsive 20–48px gutter. Other widths retain 42/56/72rem, `2xl` is 96rem, and `full` is 100%.

**Do not declare every component correctly styled yet.** The current compatibility layer still misses **41 distinct legacy class tokens selected by current production branches**, across six components, the unsubscribe route, and the bracket plugin page. Three additional tokens exist in reachable component APIs but have no current caller selecting their branches. The missing tokens affect positioning, responsive spacing, state colors, expand/collapse indicators, focus styling, and separators; not just decoration.

There is **no source evidence here of a new missing `hidden` / `fixed` / `inset-0` rule on the migrated dialogs or watch controls**. Those controls predominantly use recipes. Absence of such a finding is not a visual/accessibility sign-off.

### Scope and corrected reachability

- Inspected all **143** entries in [Copernicus's dispositions](./design-component-dispositions.md), plus other current component files, **43 Astro route templates**, eight reachable layout/wrapper/plugin templates, and the privacy MDX route and five content files with literal class attributes. The automated comparison covered **234 component/route/layout/plugin files**; the MDX class sites were checked separately.
- A conservative import graph still reaches 142 of the listed components; `technology/RelatedTechnologies.astro` lost its last caller when the technology profile moved to route-owned related links.
- Resolving the **named exports actually imported** from `src/components/ui/index.ts` reduces the listed components with production rendering paths to **130**. Twelve more were barrel-only graph overreach: `common/Heading.vue`, `ui/Card.vue`, `ui/CommandBar.vue`, `ui/Grid.vue`, `ui/HairlinePanel.vue`, `ui/Hero.vue`, `ui/KickerStrip.vue`, `ui/SectionMark.vue`, `ui/SectionRail.vue`, `ui/Stack.vue`, `ui/StatRow.vue`, `ui/accordion.vue`. Keep their retained-library/story dispositions; **do not treat them as current-route regressions or delete them from this audit**.
- Routes import `Container` from the barrel, not all its other exports. Matrix callers select `size="xl"`; missing `full` / `2xl` width utilities are therefore API gaps, not the cause of today's matrix width.

## Ranked next-phase blockers

“Blocking” below means blocking the requested all-components styling sign-off, not proven application failure. Reproduce with source fixtures and then main-owned Browser checks; no production submissions are needed.

| Rank | Surface / source | Concrete missing classes and consequence | Next bounded action / acceptance |
| --- | --- | --- | --- |
| P1 | `articles/RelatedVideos.astro:104`; related-video branch of `/read/cgroups-from-chaos-to-control` | `bottom-2`: runtime badge is absolute inside an `overflow-hidden` image wrapper but has no bottom inset. Its auto static position can place it after the full-height image and clip it. `right-2` and the other badge rules exist. | Give the badge an explicit recipe-owned inset; verify visible duration at mobile/desktop and with an unknown runtime. Do not alter video destinations. |
| P1 | `src/lib/shows/plugins/bracket/pages/Brackets.astro:67`; `/shows/klustered/brackets`, nonempty data branch | `min-w-64`: horizontal round columns lose their intended 16rem minimum width. `flex-shrink-0` is present, but does not set that minimum. Empty “No brackets yet” cannot reveal this. | Style a round-column primitive; fixture at least two rounds, long competitor labels, and mobile horizontal scrolling. Live BRACKETS_READ data was not fetched. |
| P1 | `articles/cgroups/HierarchyExplorer.tsx:14–70,110,180–210,313–314,404–421,466–574`; `/read/cgroups-from-chaos-to-control` | 23 distinct missing tokens (full list below). Five controller badge backgrounds, several controller text colors, v1/v2 borders and tints, hover feedback, and `rotate-90` are unsupported. Expansion still works but the chevron does not rotate. | Migrate this instructional widget's explicit state map to a bounded recipe or authored classes; preserve labels and behavior. Check v1 and v2, expanded/collapsed nodes, named controller badges and fallback badge. Do not blindly restore obsolete colors if Academy semantic equivalents are intended. |
| P1 | `pages/unsubscribe.astro:129`; `/unsubscribe`, POST failure branch | `bg-red-50`, `dark:bg-red-900/20`, `dark:text-red-400` absent. Light `text-red-700` remains applied in dark mode, without the intended error surface or dark foreground. This is a contrast risk, not a measured ratio. | Recipe-owned error state with readable foreground/background in both schemes; test a local failure fixture, not a live unsubscribe request. |
| P1 verification | `articles/cgroups/CgroupTimeline.tsx:312`; keyboard milestone controls | Missing `focus:outline-none`, `focus-visible:ring-2`, `focus-visible:ring-slate-400/50`, `focus-visible:rounded-lg`. There is no intended authored focus treatment. **Do not assert focus is invisible**: the missing outline-removal rule leaves browser-native focus possible. | Add/verify one coherent focus-visible treatment before adding any outline suppression. Exercise keyboard activation and arrow navigation. The current source-only audit cannot establish painted focus visibility. |
| P2 | `common/AuthorAvatarGroup.vue:3`; article cards on `/read`, series/profile related content | `-space-x-3` absent: avatar stack no longer overlaps. The outer positive `space-x-3` rule is not equivalent. | Add bounded avatar-group spacing; check 1, 2, 3, and overflow authors. `bg-green-400` is a separate dormant indicator branch: the active ArticleCard caller explicitly passes false. |
| P2 | `articles/cgroups/PodCgroupMapper.tsx:480` | `md:py-0`, `md:px-2` absent: mobile arrow spacing persists in the desktop horizontal composition. | Preserve mobile padding and apply desktop switch at 768px; check every QoS example. |
| P2 | `technology/TopicHub.astro:139`; e.g. `/technology/kubernetes` with news | `divide-y`, `divide-black/10`, `dark:divide-white/10` absent. Outer `border-y` is present but does not draw row separators. | Use semantic per-row rules; test 0/1/multiple news rows and both schemes. |
| P3 | `technology/TopicHub.astro:112`; learning-path branch | `hover:bg-primary/[0.03]` absent. Border/text hover rules exist, so the entire hover state is not missing. | Fold the surface hover into the same bounded content recipe; retain valid learning-path destinations. |
| P3 | `articles/cgroups/CgroupTimeline.tsx:329,351` | `tabular-nums`, `text-[0.625rem]` absent. Panda's `.fv-num_tabular-nums` is **not** the legacy `.tabular-nums` selector. | Prefer readable Academy type and numeric alignment; do not prioritize tiny type over the state/layout fixes. |

## Exact current selector inventory

Paths below are relative to `projects/rawkode.academy/website/`. Every token below is absent from the parsed generated Panda stylesheet, authored global stylesheet, and the owning component's local styles. An exact class-match selector is `[class~="TOKEN"]`; interactive tokens additionally require their state (e.g. `[class~="hover:text-white"]:hover`, `[class~="focus-visible:ring-2"]:focus-visible`). `dark:` tokens require the applied `html.dark` ancestor; `md:` tokens require the 768px media condition. Adding a similarly named Panda class or an unprefixed utility does not satisfy these contracts.

Counts: **44 unique tokens / 51 source occurrences** after removing inline-CSS false positives; **41 selected production tokens + 3 dormant API tokens**. These are class-token counts, not rendered element counts. A dynamic token repeated across branches is counted once per component in the lists.

### `src/components/articles/RelatedVideos.astro`

- `bottom-2` — 104.

### `src/components/articles/cgroups/CgroupTimeline.tsx`

- `focus:outline-none` — 312.
- `focus-visible:ring-2` — 312.
- `focus-visible:ring-slate-400/50` — 312.
- `focus-visible:rounded-lg` — 312.
- `tabular-nums` — 329.
- `text-[0.625rem]` — 351.

### `src/components/articles/cgroups/HierarchyExplorer.tsx`

- `bg-red-500/20` — 14.
- `bg-amber-500/20` — 15.
- `text-amber-400` — 15, 49.
- `bg-emerald-500/20` — 16.
- `bg-purple-500/20` — 17.
- `text-purple-400` — 17.
- `bg-cyan-500/20` — 18.
- `text-cyan-400` — 18.
- `border-red-500/30` — 31, 485.
- `shadow-red-500/10` — 32.
- `border-amber-500/30` — 50.
- `shadow-amber-500/10` — 51.
- `shadow-emerald-500/10` — 70, 552.
- `bg-slate-500/20` — 110.
- `hover:text-slate-300` — 180, 407, 421.
- `hover:bg-slate-700/50` — 180.
- `rotate-90` — 188.
- `hover:text-white` — 210.
- `bg-red-500/5` — 313, 485.
- `border-emerald-500/20` — 314.
- `bg-emerald-500/5` — 314, 574.
- `text-red-400/70` — 466.
- `text-emerald-400/70` — 545.

### `src/components/articles/cgroups/PodCgroupMapper.tsx`

- `md:py-0` — 480.
- `md:px-2` — 480.

### `src/components/common/AuthorAvatarGroup.vue`

- `-space-x-3` — 3.
- `bg-green-400` — 18 (**dormant in current callers**).

### `src/components/technology/TopicHub.astro`

- `hover:bg-primary/[0.03]` — 112.
- `divide-y` — 139.
- `divide-black/10` — 139.
- `dark:divide-white/10` — 139.

### `src/components/ui/Container.vue`

- `max-w-screen-2xl` — 26 (**dormant in current callers**).
- `max-w-full` — 27 (**dormant in current callers**).

### `src/pages/unsubscribe.astro`

- `bg-red-50` — 129.
- `dark:bg-red-900/20` — 129.
- `dark:text-red-400` — 129.

### `src/lib/shows/plugins/bracket/pages/Brackets.astro`

- `min-w-64` — 67.

## Dynamic branches and false positives

- Vue `:class` expressions, computed literal maps in scripts, Astro `class:list` and class expressions, React `className` templates, interpolation literal fragments and nested ternaries were included. The HierarchyExplorer controller map, v1/v2 branches, unknown-controller fallback and expansion branch count even when absent on initial render.
- Missing `max-w-screen-2xl` and `max-w-full` in `ui/Container.vue:26–27` are real API gaps, but every active matrix caller uses `xl`. Do not label them live missing widths.
- `AuthorAvatarGroup.vue:18` has unsupported `bg-green-400`; `ArticleCard.astro:56` passes `showActiveIndicator={false}`. No other production caller was found. Story/default-prop behavior is separate from active-site behavior.
- `border-color` in CgroupTimeline:325 and PodCgroupMapper:369,548 is part of an inline `transition` value, **not a class**. `flex-start` in HierarchyExplorer:169 and EmptyState:36 is an inline style value, **not a missing utility**. These were removed from reported counts.
- The shim has `[class~="bg-slate-700/50"]:hover` at global.css:1742, but HierarchyExplorer emits **`hover:bg-slate-700/50`**. Different class strings; the existing rule does not cover it. This is a concrete selector-name mismatch, not a reason to suppress the finding.
- `aside--tip/caution/danger`, explorer `trajectory-rising/stable/falling`, `ed-btn--{solid,outline,ghost}` and sizes, and matrix `preview-/legend-stage-/header-/cell-/chip-/trajectory-` state classes have authored rules. They are not Uno dependencies merely because class names are interpolated.
- ThemeAwareImage's `className` pass-through is caller-owned. The current content caller supplies `my-8 rounded-lg shadow-lg`, all defined. EmailPreferences' `tech-${techId}` is an ID, not a CSS utility.
- The branding page contains a JavaScript string that constructs `<style>` markup for downloadable SVGs. A naive style-tag regex parses its `${content}` as CSS and fails; this is not malformed route CSS. Its real authored style block was parsed separately.
- The four Zitadel MDX wrappers use `relative w-full aspect-video rounded-xl overflow-hidden bg-black shadow-2xl my-8`; those rules exist. Their content does not create an additional missing-utility blocker. Privacy's editorial classes are authored globally.
- `prose`, `sr-only`, `group`, legacy font aliases, `focus-ring`, and scoped component class names must not be blanket-flagged. Rules/marker uses were inspected. A resolved legacy font alias is not evidence that an obsolete font is being loaded.

## Retained but not currently rendered: separate backlog

These remain within the original 143-entry review set but are **not active-route blockers**. No deletion is authorized. Other no-production-path components in the dispositions document remain outside the production gate; story-only utilities are not evidence of a live route regression.

| Component | Unsupported retained API selectors | Selection |
| --- | --- | --- |
| `common/Heading.vue` | `md:text-base`, `md:text-lg`, `md:text-xl`, `md:text-3xl`, `lg:text-5xl` | Only barrel/reusable/story path; no selected production export. |
| `technology/RelatedTechnologies.astro` | `group-hover:text-secondary-content` | Last profile consumer removed; no current import. |
| `ui/Card.vue` | `border-[var(--editorial-hairline)]`, `border-[var(--editorial-hairline-strong)]`, `rounded-3xl`, `mt-auto` | Only barrel/reusable/story path; no selected production export. |
| `ui/Grid.vue` | `grid-cols-4`, `grid-cols-6`, `grid-cols-[repeat(auto-fit,minmax(250px,1fr))]`, `grid-cols-[repeat(auto-fill,minmax(250px,1fr))]`, `md:grid-cols-6`, `lg:grid-cols-1`, `lg:grid-cols-4`, `lg:grid-cols-5`, `lg:grid-cols-6`, `gap-0` | Only barrel/reusable/story path; no selected production export. |
| `ui/Hero.vue` | `md:py-12`, `md:py-16`, `lg:py-20`, `md:py-20`, `lg:py-24`, `py-20`, `md:py-24`, `lg:py-32`, `md:text-lg`, `md:text-xl`, `lg:text-3xl` | Only barrel/reusable/story path; no selected production export. |
| `ui/Stack.vue` | `gap-0`, `justify-evenly` | Only barrel/reusable/story path; no selected production export. |
| `ui/accordion.vue` | `hover:bg-[var(--surface-card-muted)]` | Only barrel/reusable/story path; no selected production export. |

## Complete 143-component disposition checklist

“Covered” means no **unresolved legacy selector** found in this source pass, not proof of correct rendering/cascade or every recipe's visual result. “API only” means the known missing branch is not selected by current callers. “Not rendered” reflects the symbol-aware import correction above. JSON-LD/head-only components naturally have no visual utility contract. All rows from the baseline are accounted for.

| Component | Source-audit result |
| --- | --- |
| `Aside.astro` | Covered |
| `academy/AcademyCatalogCard.astro` | Covered |
| `academy/AcademyCatalogMasthead.astro` | Covered |
| `academy/AcademyPage.vue` | Covered |
| `articles/ArticleCard.astro` | Covered |
| `articles/RelatedArticles.astro` | Covered |
| `articles/RelatedVideos.astro` | Findings above |
| `articles/Resources.astro` | Covered |
| `articles/Updates.astro` | Covered |
| `articles/cgroups/CgroupTimeline.tsx` | Findings above |
| `articles/cgroups/CgroupTreeDiagram.tsx` | Covered |
| `articles/cgroups/HierarchyExplorer.tsx` | Findings above |
| `articles/cgroups/PodCgroupMapper.tsx` | Findings above |
| `articles/cgroups/ResourceSimulator.tsx` | Covered |
| `articles/series/SeriesArticles.astro` | Covered |
| `auth/profile.vue` | Covered |
| `auth/sign-in-button.astro` | Covered |
| `auth/user-header.astro` | Covered |
| `branding/AcademyBrand.astro` | Covered |
| `breadcrumb/Breadcrumb.astro` | Covered |
| `breadcrumb/BreadcrumbJsonLd.astro` | Covered |
| `command-palette/CommandPalette.vue` | Covered |
| `common/AuthorAvatarGroup.vue` | P2: overlap; indicator branch dormant |
| `common/BaseCard.vue` | Covered |
| `common/ErrorState.vue` | Covered |
| `common/Heading.vue` | Not rendered; retained |
| `common/SectionHeader.vue` | Covered |
| `common/SkeletonComment.vue` | Covered |
| `common/SkeletonText.vue` | Covered |
| `common/SkeletonTranscript.vue` | Covered |
| `common/ThemeAwareImage.astro` | Covered |
| `courses/CourseDetailHero.vue` | Covered |
| `courses/CourseModules.astro` | Covered |
| `courses/CourseSignupForm.astro` | Covered |
| `courses/CourseSignupFormClient.vue` | Covered |
| `courses/CourseSignupFormCompact.astro` | Covered |
| `courses/CourseSignupFormCompact.vue` | Covered |
| `courses/EmbeddedAppModal.vue` | Covered |
| `courses/ResourceList.vue` | Covered |
| `courses/WebContainerEmbed.vue` | Covered |
| `explorer/ExplorerHeader.vue` | Covered |
| `explorer/TechnologyExplorer.vue` | Covered |
| `explorer/cards/TechCardPopover.vue` | Covered |
| `explorer/controls/AxisSelector.vue` | Covered |
| `explorer/controls/FilterPanel.vue` | Covered |
| `explorer/controls/MultiSelectFilter.vue` | Covered |
| `explorer/views/GridView.vue` | Covered |
| `game/Achievements.vue` | Covered |
| `game/ClusterMap.vue` | Covered |
| `game/CombatScreen.vue` | Covered |
| `game/DefeatScreen.vue` | Covered |
| `game/Game.vue` | Covered |
| `game/InitialAllocationScreen.vue` | Covered |
| `game/Inventory.vue` | Covered |
| `game/Leaderboard.vue` | Covered |
| `game/MenuScreen.vue` | Covered |
| `game/VictoryScreen.vue` | Covered |
| `games/guess-the-logo/GuessTheLogo.vue` | Covered |
| `games/guess-the-logo/LogoScanline.vue` | Covered |
| `games/guess-the-logo/ResultsView.vue` | Covered |
| `games/guess-the-logo/RoundView.vue` | Covered |
| `grafana/index.astro` | Covered |
| `html/adr-jsonld.astro` | Covered |
| `html/article-itemlist-jsonld.astro` | Covered |
| `html/article-jsonld.astro` | Covered |
| `html/course-itemlist-jsonld.astro` | Covered |
| `html/course-jsonld.astro` | Covered |
| `html/faq-jsonld.astro` | Covered |
| `html/head.astro` | Covered |
| `html/learning-path-itemlist-jsonld.astro` | Covered |
| `html/learning-path-jsonld.astro` | Covered |
| `html/news-itemlist-jsonld.astro` | Covered |
| `html/news-jsonld.astro` | Covered |
| `html/opengraph.astro` | Covered |
| `html/organization-jsonld.astro` | Covered |
| `html/person-itemlist-jsonld.astro` | Covered |
| `html/person-jsonld.astro` | Covered |
| `html/podcast-series-jsonld.astro` | Covered |
| `html/search-action-jsonld.astro` | Covered |
| `html/show-itemlist-jsonld.astro` | Covered |
| `html/technology-article-jsonld.astro` | Covered |
| `html/technology-jsonld.astro` | Covered |
| `html/video-itemlist-jsonld.astro` | Covered |
| `html/video-metadata.astro` | Covered |
| `image/ZoomableImage.astro` | Covered |
| `lead-magnet/K8sCheatsheetCTA.vue` | Covered |
| `news/RelatedNews.astro` | Covered |
| `news/WireSubscribeCard.astro` | Covered |
| `newsletter/NewsletterCTA.astro` | Covered |
| `newsletter/NewsletterWidget.vue` | Covered |
| `organizations/ContactFallback.astro` | Covered |
| `organizations/PartnershipApplicationForm.vue` | Covered |
| `posthog/index.astro` | Covered |
| `read/ArticleByline.astro` | Covered |
| `read/ArticleHeader.astro` | Covered |
| `read/ArticleTOC.astro` | Covered |
| `read/EndSlug.astro` | Covered |
| `series/SeriesLink.astro` | Covered |
| `settings/EmailPreferences.vue` | Covered |
| `settings/PreferenceSwitch.vue` | Covered |
| `settings/TestEmailButton.vue` | Covered |
| `shell/AcademyFooter.astro` | Covered |
| `shell/AcademyHeader.astro` | Covered |
| `show/ShowCard.astro` | Covered |
| `show/ShowNav.astro` | Covered |
| `show/SubscribeLinks.astro` | Covered |
| `technology/RelatedTechnologies.astro` | Not rendered; retained |
| `technology/TopicHub.astro` | Findings above |
| `theme/ThemeScript.astro` | Covered |
| `ui/Card.vue` | Not rendered; retained |
| `ui/CommandBar.vue` | Not rendered; retained |
| `ui/Container.vue` | API only: 2 dormant width branches |
| `ui/EditorialButton.vue` | Covered |
| `ui/EditorialShell.astro` | Covered |
| `ui/EmptyState.vue` | Covered |
| `ui/Grid.vue` | Not rendered; retained |
| `ui/HairlinePanel.vue` | Not rendered; retained |
| `ui/Hero.vue` | Not rendered; retained |
| `ui/KickerStrip.vue` | Not rendered; retained |
| `ui/LiveDot.vue` | Covered |
| `ui/MLabel.vue` | Covered |
| `ui/MastheadBar.vue` | Covered |
| `ui/SectionMark.vue` | Not rendered; retained |
| `ui/SectionRail.vue` | Not rendered; retained |
| `ui/Stack.vue` | Not rendered; retained |
| `ui/StatRow.vue` | Not rendered; retained |
| `ui/ThemeToggle.vue` | Covered |
| `ui/UtilityShell.astro` | Covered |
| `ui/accordion.vue` | Not rendered; retained |
| `video/CloudflareWhepPlayer.vue` | Covered |
| `video/LiveStreamGate.vue` | Covered |
| `video/ShowVideoSection.astro` | Covered |
| `video/StreamNotifyButton.vue` | Covered |
| `video/TechnologyVideoSection.astro` | Covered |
| `video/VideoCast.astro` | Covered |
| `video/VideoProgressBar.vue` | Covered |
| `video/VideoReactions.astro` | Covered |
| `video/VideoReactionsClient.vue` | Covered |
| `video/comments.vue` | Covered |
| `video/player.vue` | Covered |
| `video/transcript.vue` | Covered |
| `video/video-content-tabs.vue` | Covered |
| `video/video-feed.astro` | Covered |

## Test/design-contract drift

- `src/tests/design-tokens.test.ts:51` requires `PublicationNav` in app.astro. Current production uses `AcademyHeader` / `AcademyFooter`; do not restore the old nav just to make that assertion green.
- The same test reads `navigation/PublicationNav.astro` and requires terminal chrome. That retained unused component is not evidence about the current shell. Its gray-only regex neither validates selector emission nor checks arbitrary values, responsive prefixes, semantic states or non-gray palette classes.
- Its warm-paper/ink prose and the Instrument Serif / Inter Tight / JetBrains Mono prescriptions in DESIGN.md are stale relative to the user-approved Academy Red Hat/pink system. Current semantic aliases resolve to Academy values. Missing legacy selectors should normally be migrated to Academy recipes, not used as a mandate to revive the old palette.
- `src/tests/academy-documents.test.ts` covers selected document routes/components and source-shape rules; it excludes these cgroups islands and most conditional/error surfaces. Passing it cannot close this audit.
- `scripts/check-academy-shell.mjs` checks canonical wrappers, recipe exports/slots and a bounded watch-source palette list. It is useful, but does not compare every emitted legacy class token with actual CSS selectors. Do not weaken it or equate its success with selector coverage.
- Proposed next-phase regression test: parse class expressions and finite variant maps, preserve named-export reachability, parse escaped CSS class/attribute selectors, check exact token plus state/media coverage, and maintain small explicit exceptions for inline styles, marker classes, external player CSS and inactive library APIs. Test both branch output and style declaration semantics; merely searching CSS text produces the `bg-slate-700/50` false match above.

## Evidence and remaining gate

- Read-only inventory used installed `@astrojs/compiler` 3.0.1 (Astro attributes/frontmatter), Vue compiler 3.5.35 (SFC/template bindings), TypeScript AST (literal maps/JSX/ternaries/templates), PostCSS 8.5.15 plus selector-parser 7.1.1 (escaped Panda selectors, class attributes and local CSS). No dependency changes. No CSS parse errors remained after excluding the branding example-string false positive.
- Compared the **actual on-disk** generated CSS, not hypothetical utility output from a config. Panda's include scope is `packages/design-system/src/**/*.{ts,vue}`; the website no longer imports an Uno integration. A legacy `md:grid-cols-6` string cannot cause Panda to emit that exact utility.
- CSS snapshot hashes:
  - `src/styles/global.css`: SHA-256 `6b32f5a5142ac306d1b5b87d3b2796409efe3b5660507a8b69ecbe9e07921c6e` (66284 characters).
  - `packages/design-system/styled-system/styles.css`: SHA-256 `15db0c1994181121fbd1b4a6cf27aff14d2f7653114fc6f52bd6c38be723e9a6` (107692 characters).

Source checks establish selector presence/absence, not stylesheet delivery, winning cascade, mobile paint, live data availability, iframe styling or accessibility conformance. No deployed/SSR HTML was fetched in this task. The graph is conservative outside the explicitly resolved UI barrel; no arbitrary runtime module selection or user-supplied class strings can be proven exhaustively from literals.

**Next-phase gate:** fix or explicitly accept the ranked active gaps; keep dormant library gaps separate; regenerate/check Panda through main's workflow; then main validates both schemes and narrow/wide viewports, keyboard focus, cgroups v1/v2 + expanded states, multi-author cards, nonempty brackets, populated TopicHub and a local unsubscribe-error fixture. Re-run exact-selector comparison against that generated artifact. This report alone does not close “every component correctly styled.”
