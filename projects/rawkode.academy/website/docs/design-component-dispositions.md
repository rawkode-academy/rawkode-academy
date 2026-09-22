# Legacy UI component dispositions

Status: **approved exact set removed; verification complete with unrelated guard/test limitations below.**

Snapshot: 2026-09-20, working tree based on `e5280286`. Other agents are editing active UI concurrently. This inventory describes the inspected working tree, not an immutable build artifact.

## Subsequent exact removals

The original table below is historical. Later reference audits supersede four
of its retained dispositions: `news/CVEAlert.astro` was removed in checkpoint
`5e1d65cd`; `navigation/PublicationNav.astro` and `sidebar/Sidebar.astro` are
removed in the current integration. `technology/RelatedTechnologies.astro` is
also removed after a final exact-reference check found only historical audit
records: its former profile caller now renders the recipe-backed related section
inline. The shared `/apple-touch-icon.png` asset is preserved. None has a surviving production import,
export, story or event caller. Negative test assertions forbidding the legacy
shell remain intact. Current `AcademyTopbar`, footer, auth/admin sidebar and
shared tokens are preserved. All four files remain recoverable from Git.

## Scope and decision

Removed **31 obsolete route-specific UI components and one orphan story (32 files)** after main approved the exact set and the concurrent-reference recheck passed. The original inventory retained 143 components with a discovered route/content path and 40 components without one. Main continues to change consumers; those original witnesses are historical inventory evidence, not a claim that every retained component still has the same callers. A missing production path is a screening signal, not a deletion criterion.

All candidate paths below are relative to `projects/rawkode.academy/website/src/components/`. Other website references are relative to `projects/rawkode.academy/website/`; `content/` references are repository-relative.

Removed: **exactly the 32 approved files in the removal table**. All were Git-tracked and unchanged immediately before deletion, and remain recoverable from Git HEAD. No extra candidate was deleted. No tests, assets, content, recipes, shared primitives, framework infrastructure, SEO, data helpers, or utilities were changed by this cleanup. In particular, `read/ReadNext.astro` remains despite main removing its route consumer.

## Evidence and proof boundary

- Enumerated Git-tracked and nonignored untracked paths using `git ls-files --cached --others --exclude-standard -z`: 4,355 unique paths, including 214 non-story UI components.
- Scanned 3,158 textual code/configuration/content/documentation files for imports, re-exports, literal dynamic imports and requires. Resolved relative paths, the website `@/` alias, source-root paths, extensionless imports and index modules. This is a conservative source graph, not execution tracing or a full language compiler.
- Used Astro route files and content Markdown/MDX as production roots; stories and tests were excluded only from production reachability, never from the inbound-reference audit.
- Separately searched exact filenames and component stems across repository text, including public assets, tests, MDX, configuration and docs. Supplemental scanning included SVG and confirmed there were no oversized text files omitted by the initial 2 MiB scan limit.
- Checked all candidate inbound edges against the complete proposed removal set: no edge comes from a surviving source file. There are only four internal import edges, listed in the table.
- Inspected candidate source and the current replacement compositions. Generic reusable UI is retained even when currently story-only or unimported.
- No candidate is exported by the shared UI barrel or a package entry point.
- No production glob/dynamic component loader was found that could select these candidates. See the loader audit below.
- Checked candidate Git status: zero concurrent edits among the 32 proposed files. Recheck both status and references immediately before an approved deletion.
- The proposal phase used read-only source evidence. After approval, narrow guards, tests and a design-system typecheck were run as recorded below. Main had already completed elevated root `cuenv sync -A`; no repeated sync, full build, dependency install, browser, commit or push was performed.

### Loader and reference exceptions

| Surface | Evidence and disposition |
| --- | --- |
| Storybook | `.storybook/main.ts:4` discovers `src/**/*.stories.@(js\|jsx\|mjs\|ts\|tsx)`. The one proposed story is intentionally removed together with its only component; all surviving stories are retained. This is not a production component loader. |
| Technology icons | `src/utils/resolve-technology-icon.ts:3,7` globs technology SVG assets only. No candidate component matches. |
| Course examples | `src/utils/vite-plugin-webcontainer-demos.ts:126` generates raw-file globs rooted in discovered course examples under the resolved content courses directory. No candidate component matches. |
| Astro content | `src/content.config.ts` glob loaders select content collections, not website UI component files. Content MDX imports were included in the graph. |
| Test/source walkers | `scripts/check-academy-shell.mjs` and `src/tests/design-tokens.test.ts` walk existing files for assertions, not runtime rendering. Explicit file reads were separately protected. |
| Nonliteral imports | The website shell guard imports `src/lib/theme.ts` through `new URL`; external tooling under `.claude/skills/impeccable` and `.github/skills/impeccable` has detector/browser-adapter imports. None is a production Astro component loader. Declaration-method names and shell strings were classified separately. |
| Vue dynamic components | Inspected `<component :is>` usages select passed icons/components, not legacy component filenames from a registry. |
| Same basenames | Live `articles/ArticleCard.astro` is distinct from proposed `articles/ArticleCard.vue`; live `common/SectionHeader.vue` is distinct from proposed `landing/SectionHeader.astro`. `technology/TopicHub.astro:3-4` imports the live files. `shell/AcademyFooter.astro` is distinct from `footer/Footer.astro`. |
| Public/docs references | No public runtime reference to the candidates was found. Generic “Footer” slots, `ARCHITECTURE.md` naming examples, stale `CLAUDE.md` composition descriptions and `docs/design-inventory.json` inventory records are not executable consumers. These historical documentation records are not rewritten in this bounded task. |

### Current replacement witnesses

| Retired composition | Current source evidence |
| --- | --- |
| Homepage | `src/pages/index.astro:3` imports `academy/AcademyPage.vue`; the live composition uses `academyPage`. |
| Watch directory | `src/pages/watch/index.astro:5` imports `AcademyPage`. Active video playback, transcript, reactions and progress components remain. |
| Learning-path directory/detail | `src/pages/learning-paths/index.astro:5` imports `AcademyPage`; `src/pages/learning-paths/[slug].astro:2,13-14` uses `academyDocument`, `ArticleHeader` and `ArticleByline`. |
| Read directory | `src/pages/read/index.astro:10-12` imports Academy catalog cards/masthead/recipes. Article detail primitives remain. |
| News directory | `src/pages/news/index.astro:5-8` imports the retained subscription card and Academy catalog composition. |
| Course directory | `src/pages/courses/index.astro:4-7` imports Academy catalog cards/masthead/recipe. Course delivery components remain. |
| Site footer | `src/layouts/app.astro:4` imports `shell/AcademyFooter.astro`. |
| Article card | Live `articles/ArticleCard.astro` remains reachable through article/series/technology consumers. Only the legacy Vue duplicate and its sole story are proposed. |

## Removed — exact approved set

“No inbound import” includes tests and stories, not just production roots. Every component had no discovered production path. Inbound paths below are the complete pre-deletion resolved import list; all four internal edges disappeared with the approved set. Every row is now deleted.

| Removed file | Inbound imports before removal | Why obsolete rather than reusable library |
| --- | --- | --- |
| `articles/ArticleCard.vue` | `src/components/articles/ArticleCard.stories.tsx:3` | Story-only duplicate of the active ArticleCard.astro; retains removed utility/serif styling and a stock remote placeholder. |
| `courses/CourseCard.astro` | None | Old course-specific card; current courses catalog uses AcademyCatalogCard and academyCatalog. |
| `courses/CoursesHero.astro` | None | Old courses catalog hero; current catalog uses AcademyCatalogMasthead and academyCatalog. |
| `footer/Footer.astro` | None | Retired site-wide footer; app.astro imports shell/AcademyFooter.astro. |
| `landing/EditorialCardRail.astro` | None | Retired homepage composition helper; current home uses AcademyPage and academyPage. |
| `landing/FeaturedFeature.astro` | None | Retired homepage feature composition; current home uses AcademyPage and academyPage. |
| `landing/LandingHero.astro` | None | Retired Variant A homepage hero; current home uses AcademyPage and academyPage. |
| `landing/NewsletterStrip.astro` | None | Retired homepage newsletter strip; current AcademyPage composition supplies its newsletter. |
| `landing/OnAirPanel.astro` | `src/components/landing/LandingHero.astro:6` | Only used by retired LandingHero; remove together, preserving video/data helpers. |
| `landing/SecondaryGrid.astro` | None | Retired homepage composition helper; current home uses AcademyPage and academyPage. |
| `landing/SectionHeader.astro` | None | Local helper of the retired homepage composition, not a shared-library export. |
| `landing/ValuesGrid.astro` | None | Retired homepage values composition; no current consumer. |
| `learning-paths/LearningPathCard.astro` | None | Old utility-styled learning-path card; current directory is AcademyPage. |
| `learning-paths/LearningPathHero.astro` | None | Old utility-styled path hero; current detail route uses academyDocument and ArticleHeader. |
| `learning-paths/PathCard.astro` | None | Old editorial path card; current directory is AcademyPage. |
| `learning-paths/PathsLede.astro` | None | Retired directory introduction with hardcoded curriculum copy; current directory is AcademyPage. |
| `learning-paths/PathsMasthead.astro` | None | Retired directory masthead; current directory is AcademyPage. |
| `news/NewsLead.astro` | None | Old news-index lead; current news index composes academyCatalog. |
| `news/NewsMasthead.astro` | None | Old news-index masthead; current index uses AcademyCatalogMasthead. |
| `news/NewsRow.astro` | None | Old news-index row; current news index composes academyCatalog. |
| `news/TrendingPanel.astro` | None | Retired news-sidebar ranking panel with optional placeholder destinations; no current data caller. |
| `read/ArticleGridItem.astro` | None | Old read-index article row; current read index composes academyCatalog. |
| `read/FeaturedArticle.astro` | None | Old read-index featured article; current read index composes academyCatalog. |
| `read/FilterRail.astro` | None | Old read-index filter navigation; current index uses recipe-backed filter links. |
| `read/ReadFooter.astro` | None | Retired read-index footer with default 8210 subscriber claim; current feed/pager links live in route. |
| `read/ReadMasthead.astro` | None | Unused read-index wrapper of reusable PageMasthead; current index uses AcademyCatalogMasthead. |
| `video/SeriesFilter.astro` | None | Old watch-directory series filter; current watch index is AcademyPage. |
| `video/VideoGridItem.astro` | None | Old watch-directory card; current watch index is AcademyPage. |
| `video/VideoHero.astro` | None | Old watch-directory hero; current watch index is AcademyPage. |
| `video/VideoMasthead.astro` | None | Unused watch-directory wrapper of reusable PageMasthead; current watch index is AcademyPage. |
| `video/VideoStill.astro` | `src/components/video/VideoGridItem.astro:2`<br>`src/components/video/VideoHero.astro:3` | Only used by retired VideoGridItem and VideoHero; remove this closed rendering chain together. |
| `articles/ArticleCard.stories.tsx` | Storybook discovery only | Sole story for the proposed legacy Vue ArticleCard. Remove with that component; retain the shared Vue wrapper and all other stories. |

## Kept despite no discovered production path

These 40 files are intentionally not removal candidates. “Keep” is a scope/safety disposition, not a claim that every implementation has passed a new design review.

| Kept file | Reason / evidence |
| --- | --- |
| `AsideWrapper.tsx` | Storybook harness used by AsideWrapper.stories.tsx; framework/demo infrastructure. |
| `articles/TableOfContents.astro` | Generic article navigation primitive; no evidence that its reusable contract is obsolete. |
| `common/Badge.vue` | Reusable badge with multiple retained stories; also actively edited by main. |
| `common/Button.astro` | Reusable Astro button primitive; removing a caller does not justify deleting the primitive. |
| `common/Button.vue` | Reusable button with retained stories. |
| `common/FeatureCard.vue` | Reusable card demonstrated by its retained story. |
| `common/FeaturedContent.astro` | Generic feature-content composition; insufficient obsolescence evidence. |
| `common/FormattedDate.vue` | Reusable date renderer with retained stories. |
| `common/GridLayout.vue` | Reusable layout primitive with retained story. |
| `common/Section.vue` | Reusable section primitive with retained story. |
| `common/Skeleton.vue` | Loading primitive; skeleton tests retained. |
| `common/SkeletonCard.vue` | Loading primitive; skeleton tests retained. |
| `common/SkeletonList.tsx` | Loading primitive/test surface, not an obsolete publication composition. |
| `common/SkeletonList.vue` | Loading primitive; skeleton tests retained. |
| `common/SkipLink.astro` | Accessibility primitive; no production path is not grounds for removal. |
| `common/TerminalWindow.vue` | Reusable demonstration frame with retained story. |
| `faq/accordion-wrapper.vue` | Reusable FAQ presentation; no specific replacement/deprecation evidence. |
| `faq/list.vue` | Reusable FAQ list with retained story. |
| `feature/grid.vue` | Reusable feature grid with retained story. |
| `feature/list-icons.vue` | Reusable feature-list presentation; no specific replacement/deprecation evidence. |
| `feature/list.vue` | Reusable feature list with retained story. |
| `navigation/PublicationNav.astro` | Explicitly read by src/tests/design-tokens.test.ts:59; excluded even though production shell changed. |
| `news/CVEAlert.astro` | Reusable advisory-specific UI; no proof that this distinct capability is obsolete. |
| `read/Pullquote.astro` | Generic slotted editorial primitive, not a retired route composition. |
| `read/ReadNext.astro` | Explicitly named by src/tests/academy-documents.test.ts:25 and read in that test. |
| `sidebar/Sidebar.astro` | Conservative keep: src/tests/design-tokens.test.ts:52 names it in a negative shell-import assertion; not needed for bounded removal. |
| `stats/SimpleStatsWrapper.tsx` | Retained Storybook harness for stats/simple.vue. |
| `stats/simple.vue` | Reusable statistics display used by the retained wrapper/story. |
| `testimonial/slider.astro` | Generic testimonial presentation; no specific replacement/deprecation evidence. |
| `testimonial/slider.vue` | Used by retained slider.astro and slider.stories.tsx. |
| `title/center.astro` | Generic heading primitive; lack of current callers alone is insufficient. |
| `title/h2-highlight.vue` | Generic heading primitive; lack of current callers alone is insufficient. |
| `ui/CollectionMasthead.astro` | Shared-library collection primitive, not a route-specific legacy shell. |
| `ui/CollectionToolbar.astro` | Shared-library collection primitive. |
| `ui/ContentCard.astro` | Shared-library content primitive. |
| `ui/DetailFrame.astro` | Shared-library detail primitive. |
| `ui/PageMasthead.astro` | Shared-library masthead; retained CollectionMasthead still consumes it. |
| `ui/PagerStrip.astro` | Shared-library pagination primitive. |
| `video/ContinueWatchingRail.astro` | Distinct authenticated server-island/watch-history GraphQL feature; no equivalent replacement proved. Data/network behavior is outside removal scope. |
| `vue-wrapper.tsx` | Shared Vue-in-React Storybook infrastructure; 15 other stories remain after the proposed orphan story removal. |

## Kept because a production path exists

All 143 components below remain outside the deletion scope. The right column gives one graph root witness; intervening imports are preserved. This also protects content-only components such as the cgroups demonstrations.

| Kept component | Route/content root witness |
| --- | --- |
| `Aside.astro` | `content/articles/cgroups-chaos-control/index.mdx` |
| `academy/AcademyCatalogCard.astro` | `src/pages/courses/index.astro` |
| `academy/AcademyCatalogMasthead.astro` | `src/pages/adrs/index.astro` |
| `academy/AcademyPage.vue` | `src/pages/index.astro` |
| `articles/ArticleCard.astro` | `src/pages/read/[...slug].astro` |
| `articles/RelatedArticles.astro` | `src/pages/read/[...slug].astro` |
| `articles/RelatedVideos.astro` | `src/pages/read/[...slug].astro` |
| `articles/Resources.astro` | `src/pages/read/[...slug].astro` |
| `articles/Updates.astro` | `src/pages/read/[...slug].astro` |
| `articles/cgroups/CgroupTimeline.tsx` | `content/articles/cgroups-chaos-control/index.mdx` |
| `articles/cgroups/CgroupTreeDiagram.tsx` | `content/articles/cgroups-chaos-control/index.mdx` |
| `articles/cgroups/HierarchyExplorer.tsx` | `content/articles/cgroups-chaos-control/index.mdx` |
| `articles/cgroups/PodCgroupMapper.tsx` | `content/articles/cgroups-chaos-control/index.mdx` |
| `articles/cgroups/ResourceSimulator.tsx` | `content/articles/cgroups-chaos-control/index.mdx` |
| `articles/series/SeriesArticles.astro` | `src/pages/series/[...slug].astro` |
| `auth/profile.vue` | `src/pages/shows/[showId]/[...slug].astro` |
| `auth/sign-in-button.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `auth/user-header.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `branding/AcademyBrand.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `breadcrumb/Breadcrumb.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `breadcrumb/BreadcrumbJsonLd.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `command-palette/CommandPalette.vue` | `src/pages/shows/[showId]/[...slug].astro` |
| `common/AuthorAvatarGroup.vue` | `src/pages/read/[...slug].astro` |
| `common/BaseCard.vue` | `src/pages/read/[...slug].astro` |
| `common/ErrorState.vue` | `src/pages/watch/[...slug].astro` |
| `common/Heading.vue` | `src/pages/technology/matrix.astro` |
| `common/SectionHeader.vue` | `src/pages/technology/[id].astro` |
| `common/SkeletonComment.vue` | `src/pages/watch/[...slug].astro` |
| `common/SkeletonText.vue` | `src/pages/watch/[...slug].astro` |
| `common/SkeletonTranscript.vue` | `src/pages/watch/[...slug].astro` |
| `common/ThemeAwareImage.astro` | `content/articles/discover-lazyjournal/index.mdx` |
| `courses/CourseDetailHero.vue` | `src/pages/courses/[...slug].astro` |
| `courses/CourseModules.astro` | `src/pages/courses/[...slug].astro` |
| `courses/CourseSignupForm.astro` | `src/pages/courses/[course]/[...slug].astro` |
| `courses/CourseSignupFormClient.vue` | `src/pages/courses/[course]/[...slug].astro` |
| `courses/CourseSignupFormCompact.astro` | `src/pages/courses/[...slug].astro` |
| `courses/CourseSignupFormCompact.vue` | `src/pages/courses/[...slug].astro` |
| `courses/EmbeddedAppModal.vue` | `src/pages/courses/[course]/[...slug].astro` |
| `courses/ResourceList.vue` | `src/pages/courses/[course]/[...slug].astro` |
| `courses/WebContainerEmbed.vue` | `src/pages/courses/[course]/[...slug].astro` |
| `explorer/ExplorerHeader.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/TechnologyExplorer.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/cards/TechCardPopover.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/controls/AxisSelector.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/controls/FilterPanel.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/controls/MultiSelectFilter.vue` | `src/pages/technology/matrix/advanced.astro` |
| `explorer/views/GridView.vue` | `src/pages/technology/matrix/advanced.astro` |
| `game/Achievements.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/ClusterMap.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/CombatScreen.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/DefeatScreen.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/Game.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/InitialAllocationScreen.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/Inventory.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/Leaderboard.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/MenuScreen.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `game/VictoryScreen.vue` | `src/pages/games/secret-of-kubernetes-island/index.astro` |
| `games/guess-the-logo/GuessTheLogo.vue` | `src/pages/games/cnicon/index.astro` |
| `games/guess-the-logo/LogoScanline.vue` | `src/pages/games/cnicon/index.astro` |
| `games/guess-the-logo/ResultsView.vue` | `src/pages/games/cnicon/index.astro` |
| `games/guess-the-logo/RoundView.vue` | `src/pages/games/cnicon/index.astro` |
| `grafana/index.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `html/adr-jsonld.astro` | `src/pages/adrs/[...slug].astro` |
| `html/article-itemlist-jsonld.astro` | `src/pages/read/index.astro` |
| `html/article-jsonld.astro` | `src/pages/read/[...slug].astro` |
| `html/course-itemlist-jsonld.astro` | `src/pages/courses/index.astro` |
| `html/course-jsonld.astro` | `src/pages/courses/[...slug].astro` |
| `html/faq-jsonld.astro` | `src/pages/organizations/partnerships/index.astro` |
| `html/head.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `html/learning-path-itemlist-jsonld.astro` | `src/pages/learning-paths/index.astro` |
| `html/learning-path-jsonld.astro` | `src/pages/learning-paths/[slug].astro` |
| `html/news-itemlist-jsonld.astro` | `src/pages/news/index.astro` |
| `html/news-jsonld.astro` | `src/pages/news/[...slug].astro` |
| `html/opengraph.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `html/organization-jsonld.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `html/person-itemlist-jsonld.astro` | `src/pages/people/index.astro` |
| `html/person-jsonld.astro` | `src/pages/people/[id].astro` |
| `html/podcast-series-jsonld.astro` | `src/pages/shows/[showId].astro` |
| `html/search-action-jsonld.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `html/show-itemlist-jsonld.astro` | `src/pages/shows/index.astro` |
| `html/technology-article-jsonld.astro` | `src/pages/technology/[id].astro` |
| `html/technology-jsonld.astro` | `src/pages/technology/[id].astro` |
| `html/video-itemlist-jsonld.astro` | `src/pages/watch/index.astro` |
| `html/video-metadata.astro` | `src/pages/shows/[showId].astro` |
| `image/ZoomableImage.astro` | `content/articles/zed-show-and-tell.mdx` |
| `lead-magnet/K8sCheatsheetCTA.vue` | `src/pages/resources/kubernetes/1.35-cheatsheet.astro` |
| `news/RelatedNews.astro` | `src/pages/news/[...slug].astro` |
| `news/WireSubscribeCard.astro` | `src/pages/news/index.astro` |
| `newsletter/NewsletterCTA.astro` | `src/pages/learning-paths/[slug].astro` |
| `newsletter/NewsletterWidget.vue` | `src/pages/learning-paths/[slug].astro` |
| `organizations/ContactFallback.astro` | `src/pages/organizations/index.astro` |
| `organizations/PartnershipApplicationForm.vue` | `src/pages/organizations/partnerships/index.astro` |
| `posthog/index.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `read/ArticleByline.astro` | `src/pages/learning-paths/[slug].astro` |
| `read/ArticleHeader.astro` | `src/pages/adrs/[...slug].astro` |
| `read/ArticleTOC.astro` | `src/pages/read/[...slug].astro` |
| `read/EndSlug.astro` | `src/pages/read/[...slug].astro` |
| `series/SeriesLink.astro` | `src/pages/read/[...slug].astro` |
| `settings/EmailPreferences.vue` | `src/pages/settings/index.astro` |
| `settings/PreferenceSwitch.vue` | `src/pages/settings/index.astro` |
| `settings/TestEmailButton.vue` | `src/pages/settings/index.astro` |
| `shell/AcademyFooter.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `shell/AcademyHeader.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `show/ShowCard.astro` | `src/pages/people/[id].astro` |
| `show/ShowNav.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `show/SubscribeLinks.astro` | `src/pages/shows/[showId].astro` |
| `technology/RelatedTechnologies.astro` | `src/pages/technology/[id].astro` |
| `technology/TopicHub.astro` | `src/pages/technology/[id].astro` |
| `theme/ThemeScript.astro` | `src/pages/shows/[showId]/[...slug].astro` |
| `ui/Card.vue` | `src/pages/technology/matrix.astro` |
| `ui/CommandBar.vue` | `src/pages/technology/matrix.astro` |
| `ui/Container.vue` | `src/pages/technology/matrix.astro` |
| `ui/EditorialButton.vue` | `src/pages/technology/matrix.astro` |
| `ui/EditorialShell.astro` | `src/pages/changelog/index.astro` |
| `ui/EmptyState.vue` | `src/pages/technology/matrix.astro` |
| `ui/Grid.vue` | `src/pages/technology/matrix.astro` |
| `ui/HairlinePanel.vue` | `src/pages/technology/matrix.astro` |
| `ui/Hero.vue` | `src/pages/technology/matrix.astro` |
| `ui/KickerStrip.vue` | `src/pages/technology/matrix.astro` |
| `ui/LiveDot.vue` | `src/pages/technology/matrix.astro` |
| `ui/MLabel.vue` | `src/pages/adrs/[...slug].astro` |
| `ui/MastheadBar.vue` | `src/pages/technology/matrix.astro` |
| `ui/SectionMark.vue` | `src/pages/technology/matrix.astro` |
| `ui/SectionRail.vue` | `src/pages/technology/matrix.astro` |
| `ui/Stack.vue` | `src/pages/technology/matrix.astro` |
| `ui/StatRow.vue` | `src/pages/technology/matrix.astro` |
| `ui/ThemeToggle.vue` | `src/pages/shows/[showId]/[...slug].astro` |
| `ui/UtilityShell.astro` | `src/pages/confirm-subscription.astro` |
| `ui/accordion.vue` | `src/pages/technology/matrix.astro` |
| `video/CloudflareWhepPlayer.vue` | `src/pages/watch/[...slug].astro` |
| `video/LiveStreamGate.vue` | `src/pages/watch/[...slug].astro` |
| `video/ShowVideoSection.astro` | `src/pages/watch/[...slug].astro` |
| `video/StreamNotifyButton.vue` | `src/pages/watch/[...slug].astro` |
| `video/TechnologyVideoSection.astro` | `src/pages/watch/[...slug].astro` |
| `video/VideoCast.astro` | `src/pages/watch/[...slug].astro` |
| `video/VideoProgressBar.vue` | `src/pages/home.astro` |
| `video/VideoReactions.astro` | `src/pages/watch/[...slug].astro` |
| `video/VideoReactionsClient.vue` | `src/pages/watch/[...slug].astro` |
| `video/comments.vue` | `src/pages/watch/[...slug].astro` |
| `video/player.vue` | `content/courses/complete-guide-zitadel/02-prerequisites.mdx` |
| `video/VideoTranscript.astro` | `src/pages/watch/[...slug].astro`; supersedes the Vue transcript in the separately authorized replacement below. |
| `video/video-content-tabs.vue` | `src/pages/watch/[...slug].astro` |
| `video/video-feed.astro` | `src/pages/home.astro` |

## Completed verification

Main approved exactly 32 files on 2026-09-20. Before deleting, the graph was rerun against 4,358 enumerated paths and 3,161 text sources. No new loader patterns appeared, no approved component acquired a production path or inbound import from outside the set, and all 32 candidate files had clean Git status. `git ls-files --error-unmatch` confirmed they were tracked. Deletion used explicit paths only.

| Check | Result |
| --- | --- |
| Post-deletion reference graph | Zero surviving imports/re-exports/literal dynamic imports/requires targeting the deleted set. MDX, stories and tests included. |
| Exact-filename supplemental search | Outside historical docs/inventory records, the only substring match was the distinct live `shell/AcademyFooter.astro` import. No dangling deleted-file reference found. |
| Deletion scope | `git diff --numstat --diff-filter=D` lists exactly the approved 32 files. No shared outgoing dependency was deleted. |
| `git diff --check` over approved paths | Passed. |
| `node --test scripts/academy-source.test.mjs` | 5/5 passed. |
| `node scripts/check-academy-shell.mjs` | Failed on `src/pages/technology/[id].astro: missing academyTechnology.css slot`; current integrated-diff blocker, not a missing deleted component. See review below. |
| `bunx --no-install vitest run src/tests/academy-documents.test.ts src/tests/design-tokens.test.ts` | 25/26 passed. All 23 document tests pass, including the retained ReadNext source read. The failing token test expects `PublicationNav` in the application shell. HEAD already uses AcademyHeader/AcademyFooter, so this is preexisting. |
| `bunx --no-install vitest run src/tests/latest-content.test.ts src/tests/video-runtime.test.ts src/tests/academy-documents.test.ts` | 3 files, 27/27 tests passed. |
| `bunx --no-install vue-tsc --noEmit` in `packages/design-system` | Passed, exit 0. No generated files rebuilt. |

No test/source-guard file directly depends on any removed component. The generic source walkers simply scan fewer files. The sole story deletion removes its Storybook discovery entry; other stories and the Vue adapter remain. Historical documentation mentions are retained as inventory history. Browser rendering, a full Astro build and the full test suite remain outside this verification boundary.

## Subsequent authorized SSR transcript replacement

On 2026-09-20 main separately approved replacing `video/transcript.vue` with
`video/VideoTranscript.astro` and removing the former once its consumers moved.
This is one additional deletion, not an expansion of the original approved 32-file cleanup.

- Before removal, the only executable references were the Watch import, the transcript test import and the shell guard's explicit file list. All now target the Astro component or its compiled output. Repository-wide filename/import searches included content MDX, public files, stories and tests; no runtime component glob selects the retired file. Historical audit/inventory mentions remain as history.
- Removed `src/components/video/transcript.vue`: its SSR-plus-hydration implementation duplicated the complete transcript in island props. The replacement renders escaped text once, retains chapter/timestamp anchors, and progressively highlights existing text nodes without fetching, HTML injection or serialized cue data. The tracked baseline remains recoverable from Git.
- Kept `common/SkeletonTranscript.vue`: `academy/AcademyReview.stories.tsx` still imports it. Kept `video/transcript-content.ts` and all caption/data helpers; the new component reuses their normalization, grouping, formatting and literal matching.
- Replaced obsolete Vue lifecycle/fetch tests with actual Astro compiler/container rendering and actual compiled client-script tests. Resource/comment tests remain. The payload guard still rejects initial cue props and now explicitly requires one server-only transcript invocation.
- Narrow verification: 34/34 tests passed across watch-transcript, performance and design-tokens. Local HTTP response for `/watch/introduction-to-gitpod` contains 113 transcript paragraphs, hidden-until-enhanced controls, zero transcript islands and no serialized `initialCues`. Browser acceptance and the final full build remain main's responsibility.

## Read-only integrated-diff review

Reviewed current working-tree changes against HEAD, focusing on the new home/watch composition and data inputs, shell/font/token contracts, technology and reading routes, form IDs/state changes, TOC behavior and the deletion boundary. This is a bounded review by the cleanup agent, not a separate independent reviewer or browser acceptance pass. No fixes outside the approved set were made.

### Blocking — current source guard prevents the build

`src/pages/technology/[id].astro:318` changes the recipe binding from `layout` to `styles`. The existing CSS import at line 24 contains `styles.css`. `scripts/check-academy-shell.mjs:108-111` searches the extracted source with a textual property regex and mistakes that import string for a recipe slot access. The actual guard fails with `missing academyTechnology.css slot`, and `package.json` runs this guard before the website build.

A read-only comparison through the real `getAstroRecipeSource` helper found no `css` slot match with HEAD's `layout` binding, but one match inside the import string with the current `styles` binding. Main should resolve the binding/guard collision before claiming build readiness; adding a fake recipe slot would not fix the underlying guard defect. This failure is unrelated to the 32 deletions.

### Nonblocking — watch-search promise exceeds its indexed data

`src/components/academy/AcademyPage.vue:101` offers search by “topics, tools, or speakers”, but the predicate at lines 26-28 only searches title and description. `src/pages/watch/index.astro:37-47` supplies a compacted subtitle/description and no guest/speaker metadata. A speaker absent from those short strings cannot be found, even when present in the video's cast. Main can either index cast/search metadata or narrow the placeholder. The complete archive remains linked in server-rendered HTML.

### Preexisting check limitation — not a new-diff finding

`src/tests/design-tokens.test.ts:51` still expects the old PublicationNav shell. `git show HEAD:projects/rawkode.academy/website/src/layouts/app.astro` already imports AcademyHeader and AcademyFooter, exactly as the current untouched shell does. Keep this separate from new regressions and from cleanup verification.
