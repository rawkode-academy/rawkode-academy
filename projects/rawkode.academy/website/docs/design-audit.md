# Website design audit — PR #1355

Status: in progress. No blanket visual sign-off.

## Acceptance standard

Every public URL and every visual component has an explicit disposition. Review
the whole page, including the footer, at mobile and desktop sizes. Check dark
mode, keyboard use, and interactive states for each distinct component. A build
pass, source review, or shared template does not count as a rendered page review.

Every element must support orientation, discovery, learning, an action, or a real
state. Remove decorative controls, redundant labels, empty media frames, and
duplicate navigation. Preserve useful content and functional behavior.

## Work sequence

1. Reconcile source routes, published content, redirects, and runtime routes.
2. Audit shared foundations and component ownership; fix cascading defects.
3. Review and refine each distinct page composition and interactive state.
4. Review every concrete URL against the corrected implementation.
5. Run appropriate checks, independent review, and deployed preview verification.

## Defects and decisions

| ID | Finding | Disposition | Evidence |
| --- | --- | --- | --- |
| F01 | Two competing palettes/type systems; stale design documentation | Palette aliases unified; documentation and remaining active consumers pending | `global.css`, `panda.config.ts` |
| F02 | Academy fonts reference family names rather than Astro font variables | Implemented; Browser computed fonts confirmed | `panda.config.ts`, rendered homepage |
| F03 | Homepage global link color overrides primary button contrast | Implemented; Browser confirmed foreground | `pages/index.astro`, rendered homepage |
| F04 | Homepage topic tabs show generic copy without destinations | Removed; replaced by actual Watch/Read/Learn links | `AcademyPage.vue` |
| F05 | Homepage repeats content in concealed horizontal rails with empty fallback art | Replaced by visible grids and ruled learning-path rows; actual video/News art | `AcademyPage.vue`, `academyPage.ts` |
| F06 | Catalog repeated “Technology profile” metadata without distinguishing information | Real categories/descriptions and honest initials; final visual sweep pending | `technology/index.astro` |
| F07 | Hairline shorthand resets border color to currentColor | Border token includes semantic border color; Browser verified | `panda.config.ts` |
| F08 | Courses/Read feature compositions omit existing artwork | Restored content artwork; mobile ordering corrected | `pages/courses/index.astro`, `pages/read/index.astro` |
| F09 | News contains fake archive controls and omits most stories | Full archive exposed; nonfunctional labels/duplicated latest panel removed | `pages/news/index.astro` |
| F10 | Prerendered News uses stale relative dates and inferred category labels | Absolute dates; removed inferred labels and incomplete CVSS panel | `pages/news/index.astro` |
| F11 | Course details bury curriculum below repeated stats and filler | In implementation | `CourseDetailHero.vue` |
| F12 | Article contents are below the article on mobile and can exceed desktop viewport | Added mobile disclosure and bounded sticky desktop contents; Browser pending | `ArticleTOC.astro` |
| F13 | Article recommendations repeated and coauthors unnamed | One related section; all authors named/linked | `read/[...slug].astro`, `ArticleByline.astro` |
| F14 | About is repeated cards/labels and empty embed frames | Authored photo-led composition, ruled principles, direct format links; Browser pending | `pages/about/index.astro` |
| F15 | Partnerships repeats deliverables in three sections without additional proof | Removed redundant deliverable/evidence sections; prices, terms, boundaries, application retained | `organizations/partnerships/index.astro` |
| F16 | Explorer closed controls remain keyboard-focusable; mobile lacks focus trap | Ark modal on mobile, hidden/inert desktop; Browser pending | `TechnologyExplorer.vue` |
| F17 | Transcript search does not update results | Single-copy SSR with DOM filtering, safe highlights and scoped announcements; final Browser recheck pending | `video/VideoTranscript.astro` |
| F18 | Technology profiles retain mismatched legacy composition | In implementation | `technology/[id].astro` |
| F19 | Watch page squeezes player beside metadata, duplicates transcripts and interrupts learning with signup | Full-width player; one server-rendered searchable transcript; signup after learning/related content | `watch/[...slug].astro` |
| F20 | Lesson header repeats course context, generic instructions, and next action before the lesson | Removed filler; retained course breadcrumb, position, resources, and previous/next navigation | `courses/[course]/[...slug].astro` |
| F21 | News detail infers categories by regex and repeats tags; related stories have no page bounds | Honest section label, one tag set, bounded generic-image recommendations | `news/[...slug].astro`, `RelatedNews.astro` |
| F22 | Search retains retired typography and silently caps filtered results | Academy recipe, visible label, 24-result pagination; Browser verification pending | `search.astro` |
| F23 | ADR index/detail use large cards for redundant status and format labels | Compact ruled index and author/date byline | `adrs/` |
| F24 | 404 uses font-less alternate shell, repeated status, ornamental numbered links | Canonical shell with one status, search, home, and report actions | `404.astro` |
| F25 | Branding publicly documents retired colors/typefaces; download colors depend on current theme | Correct paired palette and Red Hat type; explicit Ink/White SVG links | `organizations/branding/index.astro` |
| F26 | Unsubscribe lacks a visible email label and its error classes are missing | Shared form recipe, visible label, linked accessible error | `unsubscribe.astro` |
| F27 | Utility audit found 41 selected production tokens with no emitted CSS | Bounded component migrations in progress; see utility audit | `design-utility-audit.md` |
| F28 | Recipe guard treats imported `styles.css` text as a recipe slot | Lexically scoped AST guard and regression cases | `scripts/academy-source.mjs` |
| F29 | Unlayered Page reset overrides all Panda control font sizes and weights | Remove duplicate wrapper reset; retain shared layered reset; explicit search-button border | `wrappers/page.astro`, `academySearch.ts` |
| F30 | Maintainer pitch uses unsupported statistics, cramped cards and repeated FAQ | Remove ungrounded count and repetition; readable process, fit criteria, contact | `maintainers/share-your-project.astro` |
| F31 | Organization pages repeat application guidance; contact template falls into a narrow orphan column | Unboxed offer comparison and focused reading-width application | `organizations/` |
| F32 | Unified Vue transcript serializes a second copy of already rendered text | Replaced with progressive DOM enhancement; payload test and compiled Browser confirmed single copy | `video/VideoTranscript.astro` |
| F33 | Transcript search scrolls the mobile input thousands of pixels offscreen | Remove automatic scrolling; filter unmatched paragraphs and empty sections in place | `video/VideoTranscript.astro` |
| F34 | Watch hydration truncates SSR archive and drops focused results; search uses abbreviated descriptions | Server GET query and pagination with full metadata; integration verification pending | `watch/index.astro`, `lib/watch-archive.ts` |
| F35 | Unsubscribe chooses account identity despite an email link, and accepts forged success query | Explicit identity scope; successful POST required for confirmation; 23 mocked route tests | `unsubscribe.astro` |
| F36 | News repeats oversized, retired-palette imagery with a meaningless graph | Shared branded SVG, compact image-led archive and related rows; Browser pending | `news/index.astro`, `NewsStoryRow.astro` |
| F37 | Changelog spends a wide column on metadata and repeats avatar footers | One readable column; author in metadata; direct code-history link | `changelog/index.astro` |
| F38 | Feeds overuses cards and repeats OPML actions; all RSS links have identical names | Flat feed rows, one OPML action, contextual labels and native format disclosure; whole-page mobile/light and desktop/dark verified | `feeds.astro` |
| F39 | Pristine required email fields look invalid immediately | Explicit aria-invalid / user-invalid selector instead of native invalid | `academyForms.ts` |
| F40 | Watch recommendations multiply into 21 videos across six sections | One bounded recommendation section; Gitpod compiled Browser confirmed | `watch/[...slug].astro` |
| F41 | SSR-only forms can send personal fields in a GET URL before hydration | POST defense and disabled-until-ready controls; ten mocked SSR/hydration tests | Course and partnership forms |
| F42 | ArticleCard SSR-only avatar error handler cannot run | Keep all author names without repeated avatar decoration | `ArticleCard.astro` |
| F43 | Homepage latest feed gives repeated covers excessive weight and hydrates static markup | Shared compact editorial rows; unchanged chronological stream; Home/Learn now SSR-only; whole-page review completed, excerpt correction pending | `AcademyPage.vue`, `index.astro` |
| F44 | ADR index runs dates into author names; first record points to retired repository path | Metadata separator, removed generic Reference kicker, source link corrected against GitHub contents API; rebuilt verification pending | `adrs/index.astro`, `content/adrs/0001-adopt-adrs.md` |
| F45 | Learning-path contents omit individual steps; one estimate understates recording time by 158 minutes | Optional H3 outline, chapter separation and anchor offset; corrected Developer Platform runtime to 428 minutes, labelled core video and removed unsupported total-workload metadata; rebuilt review pending | `ArticleTOC.astro`, learning-path routes and JSON-LD |
| F46 | Brand exports inject global SVG styling and outlines; mono specimen uppercases commands; mobile CSS example overflows by 22px | Scoped solid-color exports preserve paths; contextual download names, case-correct mono sample, bounded keyboard-accessible code example; six export unit tests pass, rebuilt Browser review pending | `lib/branding.ts`, branding page |
| F47 | Changelog has empty summary paragraphs and a redundant Updates label | Conditional summary, removed label, contextual 44px code-history links; final render pending | `changelog/index.astro` |
| F48 | Partnership detail repeats ownership, scope, cadence and fees in principles and six FAQs | Removed duplicate strip and repeated FAQ answers; retained unique Slack/support and partner-input guidance, exclusions, fees and route selection; unboxed offers and 44px fit-review link | `organizations/partnerships/index.astro` |
| F49 | Contact copy confirmation shrinks its button and changes mobile wrapping; no explicit announcement | Stable control width, contextual live-region feedback, manual recovery and fallback focus restoration; four isolated script tests pass, rebuilt Browser review pending | `ContactFallback.astro`, `academyMarketing.ts` |
| F50 | Learning-path hero and newsletter ignore reading grid; catalogue has meaningless ordinals; TOC loses keyboard outline and skips chapters during fast scroll; prerequisites expose literal Markdown | Aligned hero, contained newsletter, removed status dot/ordinals, padded focus boundary, RAF-batched reading-position calculation, plain-text prerequisites; six scroll tests, independent review and compiled desktop/mobile verification pass | Learning-path routes, `AcademyPage`, `ArticleTOC`, document/page recipes |
| F51 | Page-wide navigation crossfade overlays old and new text; claimed thumbnail morph has no paired participant | Removed decorative navigation animation and unused naming helper; retained component reduced-motion rules. Rebuilt Browser check pending | `global.css`, watch page, obsolete helper and sidebar declaration |
| F52 | About repeats a final principle divider before the next section; format copy claims courses/articles in current video-only paths | Remove final list divider and unnecessary end padding; describe selected lessons without unsupported format promises. Rebuilt delta pending | `academyAbout.ts`, About page |

## Verification log

- User-requested cuenv upgrade: verified official 0.55.1 darwin-arm64 SHA-256
  bd8745d5513fc8fb92ea386cfe494c11ffeff56642d55d5fd707f8fc946e1479.
  Task-local release binary used for successful root `sync -A` and
  `sync ci --check`; root configuration pins release 0.55.1 and all 39 generated
  workflows differ only in that version. System Nix installation is unchanged.
  Registry reports the matching v0.55.1 CUE module unavailable, so the existing
  v0.53.2 schema is retained; its mismatch warning is explicit. CI will exercise
  the release's complete-PR-diff fix on the next push.

- 19:20 BST integration build passed with pinned D2; full Vitest 554/554 across
  43 files and design-system strict check passed. Independent source review found
  no blocking regression. Nonblocking scheduled-News timing inconsistency between
  build-time routes, request-time feeds and cached search remains tracked for a
  shared deployment eligibility fix; all 37 current News routes are retained.
- About complete desktop/dark and mobile/light inspection plus rebuilt divider
  and format-copy deltas passed. Maintainer page complete desktop/mobile dark and
  light hero/focus inspection; ordered-list accessibility semantics and recipe
  consolidation remain a follow-up. No email sent.
- Navigation after the 19:20 rebuild has no old/new page text crossfade. Preview
  had to restart after the build replaced its output; the intervening 500/error
  is not counted as page-review evidence.

- 19:00 BST full integration build passed with pinned D2 after the two strict
  typing fixes. Full Vitest 521/521 and design-system strict checks passed.
  Subsequent show, discovery-publication, identity and navigation changes are not
  in that build and require another integration checkpoint.
- All five learning-path routes now have explicit visual-pass ledger entries:
  whole-page 18:30 evidence plus corrected 19:00 hero/rows/TOC/newsletter checks.
  Fast and reverse scrolling, keyboard chapter navigation, current-section state
  and mobile contained signup panels verified. No playback or subscription.
- Contact desktop copy feedback preserves 128x44px size while showing Copied;
  exact public address reaches clipboard and focus remains visible. No email sent.
- Removed unused CVEAlert and obsolete view-transition naming helper after
  reference checks; both are recoverable from Git. News and people source fixes
  have dedicated ledgers and tests, but their full visual inventory remains open.

- All four learning-path detail bodies and the index now have complete desktop
  and mobile viewport read-throughs, including prerequisites, bonus content and
  footer. Three details checked dark desktop/light mobile; Developer Platform
  checked light at both sizes. All mobile documents measure 390px at 390px.
  This is five concrete routes, not a sign-off of the remaining inventory.
- 18:58 integration attempt: full unit suite 521/521 passed; compile caught two
  strict typing issues (optional recipe class and social-link filter narrowing).
  Corrected at the boundary; fresh full build running. No deployment of this batch.

- 18:30 BST integration build passed with pinned D2: 13 parser tests, 44 source
  route / 4 bracket checks, 29 recipes, 122 interaction tests and newly maintained
  61 SSR/hydration tests. Astro checked 430 files with no errors/warnings and nine
  hints. Full Vitest 491/491 and design-system strict check passed. Subsequent
  course, News, people and F50 changes require a fresh integration build.
- Developer Platform: entire desktop/light and mobile/light page reviewed,
  including all six chapters, expanded prerequisites, contents and newsletter,
  footer/copyright. Mobile width 390/390. GitOps: entire desktop/dark and
  mobile/light page reviewed including five chapters, drills and bonus material.
  Both remain verification-pending for F50 shared corrections.
- TOC scroll correction: real-script isolated tests 6/6 and SSR 9/9 pass.
  Independent same-frame reversal and content-order probes found no blocker.
  Layout shifts after load may leave highlight stale until the next scroll/resize;
  native anchors remain usable. No ClientRouter is present.
- Branding correction in 18:30 build: lowercase monospace specimen and bounded
  300px mobile code region verified, document width 390/390; six download SVG
  payloads retain correct viewBox, paths and one fill without global style/stroke.
  Browser download completion itself could not be confirmed.
- Contact correction: mobile keyboard copy preserves a 128x44px control, visible
  focus and exact address; persistent polite announcement verified. Desktop
  final control geometry remains to check before closing F49.

- Baseline: `e5280286`, preview `21900227-rawkode-academy-website.rawkodeacademy.workers.dev`.
- Prior turn's representative checks are baseline context only. This audit will
  record concrete coverage instead of inheriting a claim that every page passed.
- Reconciled inventory: 1,064 baseline visual URLs, 44 source route templates,
  four registered Klustered pages, and 86 Read filter/page variants. Draft-only
  module 404s, redirects, endpoints, and access-sensitive routes are distinct cases.
- Current working-tree checks: design-system strict check passed; source shell
  guard passed; Astro check completed with 0 errors, 0 warnings, 7 existing hints.
  These do not establish deployed or all-page visual verification.
- Browser composition investigations (not sign-off): homepage, technology index,
  About, Courses, Teleport course, Read, cgroups article, News, Kubernetes profile,
  Partnerships. Findings above are being corrected before the exhaustive sweep.
- 16:33 BST integration checkpoint: complete website build passed (13 source
  parser tests, 44 route / 4 bracket checks, 24 recipes, 122 interaction tests,
  Astro check 0 errors / 0 warnings / 8 hints, server build). Concurrent later
  changes require another final build. D2 was unavailable locally; three article
  diagrams used text fallbacks, which remains a verification/design defect.
- Compiled local preview on port 4322: technology directory inspected at desktop
  and mobile; mobile matching, zero-result, count, and focus states rendered
  correctly. This does not sign off the entire 354-item directory or its details.
- Removed exactly 33 obsolete Git-tracked UI/story files after the closed-set
  reference audit. Recoverable from Git; no content or tests deleted. See component
  dispositions for the exact list and retained reusable components.
- 16:58 BST checkpoint: full website build passed with pinned D2 0.7.1 available
  (13 parser tests, 44 source templates / 4 dynamic bracket pages, 28 recipes,
  122 interaction tests; Astro check 410 files, 0 errors / 0 warnings / 8 hints).
  D2 diagrams compiled; this supersedes the earlier fallback limitation.
- Full Vitest checkpoint: 341 tests across 28 files passed. Later archive,
  unsubscribe, transcript and News work requires another integration run.
- Compiled Browser verified mobile search fonts/border after reset removal;
  maintainer and contact main content at mobile/desktop; contact copy action
  copied the exact public address. Final footers/dark-mode coverage still pending.
- Storybook inspected form error/light and disabled/dark states, progress 0/light
  and 100/dark, all Badge variants/dark, and bracket live/winner, long names,
  empty, and not-announced fixtures. These are fixture evidence, not live services.
- Inherited unsubscribe risk: email-mode requests do not prove address ownership
  with a token. No authorization-protocol expansion is included in this design work.
- 17:14 BST checkpoint build passed: 415 files, no Astro errors/warnings, eight
  hints; D2 available. Full unit suite 388/388 and independent SSR suite 13/13.
  Later recorded fixes still require another build.
- Privacy whole page visually reviewed at 1440x1000 dark and 390x844 light,
  including footer/copyright. Legal accuracy and email delivery are outside this
  visual sign-off. See review ledger for retained elements' purposes.
- Independent diff/reference audit: no surviving imports of 33 retired files;
  no active Uno integration in Academy website/design-system. Lockfile Uno entries
  belong to the separate Klustered project. Remaining compatibility CSS consumers
  are being migrated; source scanning is not visual assurance.
- 17:28 BST integration checkpoint: full build passed with D2, 418 files checked,
  zero Astro errors/warnings and eight hints. 399/399 Vitest tests passed; separate
  SSR suites passed 18/18 and form SSR/hydration tests passed 10/10 (run the latter
  with `node --import tsx --test src/tests/form-hydration.test.mjs`). Design-system
  Panda and Vue strict checks passed with 29 recipes. No deployed proof yet.
- 17:29 compiled Browser regression checks: News thumbnails retain 16:9 at 72px
  mobile width; pristine unsubscribe input has neutral border; mobile navigation
  fits at 390px and wraps without overflow at 320px; Gitpod has one recommendation
  section, search finds 30 matches, and clearing restores all 113 paragraphs.
- Three remaining authored-content consumers migrated: CgroupTreeDiagram,
  RelatedArticles and Aside. Their targeted tests pass; final Browser review of
  all affected authored documents remains pending.
- Checkpoint `272b68bc` pushed normally to PR #1355. Website CI run 35523021354
  and design-system CI run 35523021353 succeeded. Deployed preview:
  https://3ff27879-rawkode-academy-website.rawkodeacademy.workers.dev.
  Browser verified deployed mobile Technologies: 354 items, Kubernetes query
  20 matches, zero-result state, clear restoring 354, and no horizontal overflow.
- 17:49 BST local build passed with D2. Full Vitest 402/402 passed. Feeds whole
  page reviewed at 390x844 light and 1440x1000 dark; disclosure opens by pointer
  and closes with Enter, all sixteen feed links measure 44px high, no overflow.
  Independent GET-only checks verified 17/17 local feed/OPML endpoints with
  expected content types and parseable feed structure; no actual reader import.
- Deployed `/404`: entire page reviewed at 1440x1000 light and 390x844 light/dark.
  Search recovery for cgroups reaches the actual article result. No broken-link
  report or authentication was submitted. One extra separator is harmless.
- Homepage whole-page local review at 1440x1000 dark and 390x844 light found no
  overflow or broken imagery. A mid-word excerpt truncation remains to correct.
  Newsletter delivery/subscription has not been exercised against a live service.
- Independent browser batches could not start because agent sessions expose no
  browsers. Their source findings are not counted as visual coverage. Main session
  retains browser inspection; course and technology source ledgers remain separate.
- ADRs: both full records reviewed at desktop/dark and mobile/light. First record's
  GitHub source link and index date/author separator require rebuilt verification.
  The second record passed; authored historical decisions were preserved.
- Changelog: all sixteen entries and footer inspected at 1440x1000 dark and
  390x844 light. No overflow; minor redundant/empty markup fixes pending rebuild.
- Branding: every section and footer inspected at 1440x1000 dark and 390x844 light.
  Mobile CSS sample causes 412px document width at a 390px viewport; F46 fixes
  are not yet compiled. Downloads are not yet verified by Browser.
- Learning paths: entire desktop index reviewed. Developer Platform hero,
  prerequisites and initial steps inspected; full body and mobile review pending.
  Independent source review resolved all 31 distinct video destinations and found
  recording runtimes of 427m50s, 431m12s, 446m54s and 405m50s across the four paths.
  This is source availability/runtime evidence, not playback verification.
- Organization hub fully reviewed at 390x844 light and 1440x1000 dark through
  footer. All four main actions measure at least 44px; keyboard focus is visible
  and Enter follows the programme link. Commercial terms preserved; no contact sent.
- Partnership detail fully inspected at desktop/dark. Fit-review action selects
  the correct application route; all fields hydrate. Repeated content remains to
  be removed in the next build. No application submitted; mobile final review pending.
- Contact page fully inspected at desktop/dark and mobile/light. Exact email and
  template copied successfully, including after returning from the programme page.
  No email sent. Confirmation's mobile layout jump identified and fixed in source.
