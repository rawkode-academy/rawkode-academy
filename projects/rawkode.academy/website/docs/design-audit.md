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
| F53 | Course catalogue repeats a visible three-item count and promises unsupported future subjects in its empty-library branch | Removed duplicate count, omitted empty secondary section and used neutral no-course state. Whole dark catalogue and corrected heading verified at both sizes | `courses/index.astro` |
| F54 | Mobile course cover stops short of its column; standalone references have small hit areas | Full-column cover and shared 44px reference-link recipe, verified in compiled Browser at both sizes | `academyCourse.ts`, `courses/[...slug].astro` |
| F55 | Related technology names shift when logos are missing; identical category repeated in every row | Consistent 40px marks, matching initials and one shared category; all six Acorn links and desktop focus verified at both sizes | `academyTechnology.ts`, `technology/[id].astro` |
| F56 | Lesson signup nests cards and repeats its purpose three times; overview sponsor copy understates offers/product-update scope | One surface, one heading and explanation; explicit optional sponsor-sharing language in both forms. Final actual labels exceed 44px at both sizes; pointer toggle and keyboard focus verified without submission | Course signup components, `academyForms.ts` |
| F57 | Optional D2 integration allows a successful build to publish raw diagram source when the compiler check fails | Always register the integration: build/dev preflight requires the declared compiler while preview still works without it. Compiled SVG rendering verified; dense mobile diagram readability tracked separately in F58 | `astro.config.mts`, document contract test |
| F58 | Dense architecture diagram is unreadable on mobile; narrow GraphQL diagram expands to an excessive desktop height | Shared static figure with native enlargement toggle, keyboard-scrollable region, accessible name and written relationship description. Fitted/expanded views verified at both sizes. Normal scrolling over fitted graphics preserved; containment applies only when enlarged | `academyDiagram.ts`, `articles/Diagram.astro`, both published D2 articles |
| F59 | Coverless article reserves an empty media frame because Astro supplies a registered but empty Vue slot | Explicit media/footer presence across the renderer boundary; intrinsic text-only card height, title-only accessible name, contextual H3 below section headings. Three real Astro/Vue SSR regressions pass; final compiled desktop/mobile card and complete intrinsic focus boundary verified | `ArticleCard.astro`, `BaseCard.vue`, related/topic/series consumers |
| F60 | Enlarging a centred graph initially shows its empty top-left corner on mobile | Small progressive enhancement centres horizontal scroll on expansion and resets on collapse; native checkbox/CSS retained. Both graphs now open on their root node at mobile; architecture also verified desktop. Keyboard region focus, right-arrow panning, pointer scrolling and fitted reset rechecked on GraphQL | `articles/Diagram.astro`, two script tests |
| F61 | News signup spreads a single email field/button across the full desktop content width and does not use the compact shared signup composition | Shared compact two-column composition, H2 and one explanation; redundant paragraph removed. Native POST endpoint and email semantics retained. Desktop/mobile and keyboard focus verified in compiled 21:47 build | `news/WireSubscribeCard.astro`, one actual Astro SSR regression |
| F62 | Expressive Code shrinks copy controls to 32px with a pointer (40px for touch) | Shared renderer plugin sets 44px minimum and centred 20px icon. All six GraphQL controls measured at both sizes; keyboard focus, Enter/Copied feedback and contained code ArrowRight panning verified | `astro.config.mts`, full GraphQL article review |
| F63 | Watch feature is duplicated as the first grid tile | Show it once, keeping the 24-session page boundary and complete pagination. Actual page SSR verifies a 329-record fixture appears exactly once across 14 unfiltered pages; first page visually verified at both sizes | `watch/index.astro`, `watch-archive-ssr.test.mjs` |
| F64 | Watch breadcrumb pushes the show to the far edge; description spans 1084px; reactions sit in an empty full-width panel with small targets | Only live status uses auto margin; 680px reading measure, unboxed reactions and 44px breadcrumb/reaction/technology targets. Show recommendations use H2/H3 with no duplicate image name | `academyWatch.ts`, `watch/[...slug].astro`, `ShowVideoSection.astro` |
| F65 | One-option Comments tab hides its content on arrival; empty state repeats Comments inside nested panels | Render a direct H2 discussion when no resources exist, with one compact empty message/link. Resource tabs explicitly initialize the SSR selection. Actual SSR/hydration, empty/nonempty comment tests and compiled Browser verification | `video-content-tabs.vue`, `comments.vue` |
| F66 | Kueue description ends in four unlinked Learn more names, redundant subscription prose and nonfunctional hashtags | Remove these ten lines; real technology links and newsletter already provide those onward actions. Substantive description and learning outcomes preserved | Kueue content record; both-size full-page review |

## Verification log

- 22:11 compiled build: full Watch first page and Kueue detail inspected through
  copyright at 1440x1000 light and 390x844 dark. Ledger now has 35 whole-page
  passes; all other URLs remain individually pending. Catalogue mobile Next,
  search reset, one result, no result and clear recovery verified. Every first-page
  tile reviewed at both sizes; 24 distinct links including feature.
- Kueue: 680px desktop description, 44px reaction targets and immediately visible
  compact comments verified. Mobile playback reached 35.6s and Space paused it;
  Copy link keyboard feedback/focus and emoji-picker Enter/Escape verified without
  writes. Both tech links, cast, six recommendations, signup and copyright inspected.
  No transcript/chapter/resources data exists on this recording. Those states and
  live-player/fullscreen/casting/caption accuracy are not covered by this pass.
- Build passed: 443 Astro files, zero errors/warnings, nine hints; 116 SSR checks,
  122 interaction tests, 13 parser tests. Vitest 575/575 in 46 files, plus three new
  real comments-component tests passed. Resource-panel SSR/hydration regression
  verifies initial selection without a click. Strict Panda check and vue-tsc passed.
  Existing Zed highlight fallback remains. Fresh root cuenv 0.55.1 sync produced
  no tracked generated drift. Main-agent diff review only; independent reviewer
  unavailable, not substituted with source/test coverage.

- Checkpoint `d5b4e864` pushed normally. Website CI 35536973501 and design-system
  CI 35536973500 succeeded, including preview deployment. Current preview:
  https://75375748-rawkode-academy-website.rawkodeacademy.workers.dev.
  Hosted News compact signup and full keyboard focus verified desktop/mobile;
  all six hosted GraphQL copy controls measure 44x44 with centred 20px icons,
  complete keyboard focus and document widths 390/390 and 1440/1440.
- While CI ran, ExternalDNS and Gloo News details were each inspected through
  copyright at both sizes on the compiled 21:50 build. Native source links,
  long identifiers, generic recommendation images and signup all retained.
  ExternalDNS newsletter expansion/focus checked without submission. Ledger
  now records 33 whole-page passes; these two latest detail reviews are local.
- Final 21:50 build passed: 443 Astro files, zero errors/warnings, nine hints,
  115 SSR/hydration checks, 122 interaction tests and 13 parser tests. Full Vitest
  remains 574/574 in 46 files. Existing Zed highlighting fallback persists.
  News signup verified desktop light/dark and mobile dark; six code copy targets
  verified 44x44 at both sizes with 20px icons. Mobile first code region pans
  40px by keyboard while document scroll remains zero. No code execution.
- Full GraphQL article inspected through copyright at desktop light and mobile
  dark on 447c1270, then F62 corrected delta verified locally at both sizes.
  News archive and this article bring explicit whole-page passes to 31; source
  inventories and template samples still do not count as all-page completion.
  Latest small corrections received main-agent review only, not independent review.
- Checkpoint `fbd52a50` pushed normally. Website CI 35535690247 and design-system
  CI 35535690242 succeeded. New preview:
  https://447c1270-rawkode-academy-website.rawkodeacademy.workers.dev.
  Hosted text-only article card verified at both sizes with complete intrinsic
  focus outline; both hosted diagrams now open centred on their root node on
  mobile, then return to fitted view. Architecture width remains 390/390.
- News compact composition build passed at 21:41: 443 Astro files, zero errors
  and warnings, nine hints, 115 SSR/hydration checks, 122 interaction tests and
  13 parser tests. Native POST semantics are covered by actual Astro SSR test.
  Browser verification follows; F62 copy-control adjustment is not in this build.
- News archive on deployed f4762c10 inspected in full at 390x844 dark and
  1440x1000 light: lead story, all 36 earlier rows, newsletter and copyright.
  DOM confirms 37 distinct story destinations and 37 uses of the shared generic
  SVG. Widths 390/390 and 1440/1440. No article-specific imagery fabricated.
  F61 corrected in the compiled 21:47 build and verified at both sizes with full
  keyboard focus. Archive is now a visual pass, not sign-off of the 37 story
  detail pages. No subscription sent or news facts revalidated.
- Final 21:26 build passed: 442 Astro files, zero errors/warnings, nine hints,
  114 SSR/hydration checks, 13 parser tests and 122 interaction tests. Full
  Vitest 574/574 across 46 files passed. Existing Zed highlighting fallback
  warning remains. Final card mobile/desktop focus and intrinsic desktop height
  verified, plus centred desktop architecture enlargement. These changes are
  deployed in the fbd52a50 checkpoint above. Main-agent review only; no independent final reviewer.
- Architecture whole-page deployed review plus locally corrected F59/F60 delta
  now passes. Series empty state also inspected end to end at desktop/dark and
  mobile/dark; Enter on its recovery link reaches Read. No published series
  detail exists, so its data-present composition remains fixture-only/pending.
- Checkpoint `3541053b` pushed normally. Website CI 35533972455 and design-system
  CI 35533972424 succeeded, including cuenv 0.55.1 and `deploy.preview`.
  Preview: https://f4762c10-rawkode-academy-website.rawkodeacademy.workers.dev.
  Browser verified corrected Acorn related links at both sizes, plus compiled
  SVGs in both published diagram articles. Whole architecture article inspected
  at desktop/light and mobile/dark through copyright; discovered F59/F60 remain
  separate from compiler success. No infrastructure or subscription writes.
- Teleport lessons three and four are whole-page local passes on pushed
  `3541053b`; lessons five and six are whole-page deployed passes at both sizes.
  All authored sections, resources, navigation, hydrated optional signup and
  footer were inspected. Lesson-five Enter navigation reaches the final lesson,
  which correctly has only Previous. Posters/controls loaded (9:34 and 9:33);
  these two recordings were not played. Mobile documents remain 390px wide.
- Preview console recorded Grafana Faro transport `Failed to fetch` errors.
  UI and forms still hydrated; telemetry delivery is not verified and the cause
  has not been established. Monitoring was not disabled to hide these errors.
- Fresh required root sync passed after retry with network access; generated
  files remain unchanged. Initial sandboxed attempt could not resolve GitHub.
- 21:14 card build passed: 441 Astro files, zero errors/warnings, nine hints,
  114 SSR/hydration tests. Full Vitest 572/572 passed. Desktop review prompted
  intrinsic coverless-card height; 21:18 rebuild passed with the same checks.
  Later diagram centring requires another integration build and Browser check.
- Final 20:54 integration build passed: 44 templates, four bracket pages, 31
  recipes, 440 Astro files / zero errors / zero warnings / nine hints, and all
  111 SSR/hydration tests. Strict design-system check passed. Final Browser delta
  proves fitted GraphQL graphic is 397.8x700 desktop and bounded to 591px mobile;
  enlarged mobile region is 350x591 with 1280px scroll content. Arrow key pans
  40px. Normal pointer scrolling over the fitted graphic advances the document
  by 422px instead of trapping the gesture. Mobile width remains 390/390.
- Final architecture mobile fitted view rechecked with readable textual
  relationship description. Both articles remain verification-pending for their
  full bodies and related sections, separate from the resolved diagram defect.
- Course catalogue, Teleport overview and first two lessons, Acorn profile and
  maintainer page now have explicit whole-page plus corrected-delta visual passes.
  These six additions do not sign off other routes using their templates. Acorn
  whole-page evidence is deployed 5e1d65cd; its corrected links are local 20:32.
- 20:46 build with mandatory D2 and diagram controls passed: 440 Astro files,
  zero errors/warnings, nine hints; 13 parser, 122 interaction and 111 SSR/hydration
  tests. Full Vitest 572/572. Browser verified architecture enlargement, native
  keyboard toggling, focus and panning, pointer panning, return to fitted view,
  and 390/390 mobile plus 1440/1440 desktop document width. Both article diagrams
  exist as compiled SVGs. Article bodies are not yet whole-page visual passes.
- Strict design-system check caught raw size literals in the new diagram recipe.
  Replaced them with the existing 7xl size and a named viewport-size token;
  strict check then passed (74 files, missing 0, stale 0). Final rebuild and
  bounded overview verification follow. Main implemented/reviewed this diagram
  fix; an independent final reviewer was unavailable after delegated usage ended.
- The newly published cuenv schema v0.55.1 is now installed through `cue mod get`.
  Matched CLI/schema `sync -A` and `sync ci --check` both passed, with no version
  mismatch warning. Generated workflows, locks and env configuration remained
  byte-identical; independent review parsed all 44 workflows and confirmed the
  existing 39 generated CLI pins. System Nix binary remains unchanged.
- 20:02 BST integration build passed with D2: 44 route templates, four bracket
  pages, 30 recipes, Astro check 439 files / zero errors / zero warnings / nine
  hints. Full Vitest 570/570 and strict design-system check passed. Later narrow
  initials and clickable-label corrections require the next build.
- Independent News deployment-cutoff review found no blocker; 92 focused tests
  passed. Google News's inherited prerendered XML only ages on rebuild; the
  48-hour helper uses evaluation time, not an independently verified live request
  clock. Test wording narrowed accordingly.

- Checkpoint `5e1d65cd` pushed normally to PR #1355. Website CI 35529167454
  and design-system CI 35529167321 succeeded using cuenv 0.55.1. Website
  `deploy.preview` passed and produced worker d3ab9ff5-9ae4-4a19-b528-35b73a5c4fcf:
  https://d3ab9ff5-rawkode-academy-website.rawkodeacademy.workers.dev.
  Browser inspected the deployed Technology directory at desktop/dark and
  mobile/light, filtered Acorn to 1 of 354 with visible focus, and confirmed
  390px document width. Acorn detail received whole-page desktop/mobile review;
  related-project alignment needs F55. Later local edits are not in this deploy.

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
