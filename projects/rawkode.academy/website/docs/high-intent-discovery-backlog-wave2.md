# Wave 2 High-Intent Discovery Backlog (March 26, 2026)

## Scope
This backlog defines and prioritizes high-intent organic discovery work only. It does not modify content implementation files.

## Signal Snapshot (PostHog, Last 90 Days)
- Referrer domains by `page_view`: `www.google.com` 192 pageviews, `duckduckgo.com` 103, `www.bing.com` 17, `www.youtube.com` 57.
- Top search landing paths include:
  - `/` (52), `/courses/complete-guide-zitadel/install-docker-compose` (16), `/courses/complete-guide-zitadel` (7), `/technology` (6), `/technology/kube-vip` (4).
  - `/read/introducing-technology-matrix` (6), `/read/kyverno-cel-validating-policy` (4), `/read/lazyjournal-log-viewer` (4), `/read/introducing-cuenv` (3), `/read/building-rust-cue-library` (3).
  - `/technology/matrix` (17 search, 21 YouTube-referrer), `/technology/matrix/advanced` (16), `/technology/kube-vip` (4), `/technology/devspace` (3), `/technology/flatcar` (3).
  - `/watch/hands-on-introduction-to-portainer` (3), `/watch/navigating-kairos-immutable-operating-systems-with-a-cloud-native-twist` (2), `/watch/gitops-tutorial-with-fluxcd-2-gitops-toolkit` (2), `/watch/build-a-production-ready-kubernetes-cluster-with-spectro-cloud-palette-no-code-tutorial` (2).

## Prioritized Backlog (20 Items)

| Rank | Category | Backlog Item | Target Query / Theme | Format | Internal-Link Destination | Priority Rationale |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Article refresh (organic winner) | Refresh `/read/introducing-technology-matrix` | `technology matrix`, `cloud native tech radar` | Refresh article + updated SERP metadata | `/technology/matrix` | Highest-read article from search (`6`/`5`) and directly feeds highest-interest hub cluster (`/technology/matrix`, `/technology/matrix/advanced`). |
| 2 | Technology hub improvement | Upgrade `/technology/matrix` hub | `cloud native technology matrix`, `platform engineering tool landscape` | Hub UX/content block enhancement | `/technology/matrix/advanced` | Strongest technology landing signal (`17` search + `21` YouTube referrer pageviews); compounding hub effect across many downstream technologies. |
| 3 | Article refresh (organic winner) | Refresh `/read/kyverno-cel-validating-policy` | `kyverno validatingpolicy`, `kyverno cel` | Refresh article + update examples/version notes | `/technology/kyverno` | Consistent search traction (`4`/`4`) and strong high-intent security-policy audience fit. |
| 4 | Article refresh (organic winner) | Refresh `/read/lazyjournal-log-viewer` | `kubernetes log viewer`, `lazyjournal` | Refresh article + comparison section | `/technology/loki` | Strong search performance (`4`/`4`), clear ops-intent query class, opportunity to route users to observability cluster pages. |
| 5 | Learning path / comparison | New comparison: ZITADEL self-hosted auth path | `zitadel self hosted`, `zitadel kubernetes setup` | New comparison page + implementation checklist | `/courses/complete-guide-zitadel/install-docker-compose` | Highest non-home search landings are ZITADEL course steps (`17`, `9`, `8`), indicating strong transactional learning intent. |
| 6 | Video companion piece | Companion article for `/watch/hands-on-introduction-to-portainer` | `portainer kubernetes`, `portainer onboarding` | New article companion | `/watch/hands-on-introduction-to-portainer` | Top watch search landing (`3` pageviews) with clear beginner-to-intermediate platform operations intent. |
| 7 | Technology hub improvement | Upgrade `/technology/matrix/advanced` | `technology matrix advanced`, `compare cloud native tools` | Advanced hub UX + filtering guidance content | `/learning-paths/build-your-first-kubernetes-developer-platform` | Second-highest technology discovery page (`16` search), ideal mid-funnel bridge into structured learning. |
| 8 | Video companion piece | Companion article for `/watch/navigating-kairos-immutable-operating-systems-with-a-cloud-native-twist` | `kairos immutable os`, `kairos kubernetes edge` | New article companion | `/watch/navigating-kairos-immutable-operating-systems-with-a-cloud-native-twist` | High-intent watch discovery (`2`) plus adjacent immutable-OS demand from `/technology/flatcar` traffic (`3`). |
| 9 | Article refresh (organic winner) | Refresh `/read/introducing-cuenv` | `cuenv`, `cue env management` | Refresh article + onboarding quickstart | `/read/building-rust-cue-library` | Search interest remains (`3`/`3`) with strong topical adjacency to Rust+CUE content cluster. |
| 10 | Video companion piece | Companion article for `/watch/gitops-tutorial-with-fluxcd-2-gitops-toolkit` | `fluxcd gitops tutorial`, `gitops toolkit` | New article companion | `/watch/gitops-tutorial-with-fluxcd-2-gitops-toolkit` | Watch search traffic (`2`) + supporting proof from existing Flux article search entries (`/read/fluxcd-the-inevitable-choice`). |
| 11 | Technology hub improvement | Upgrade `/technology/kube-vip` | `kube-vip bare metal`, `kube-vip load balancer` | Hub improvement + FAQ | `/courses/complete-guide-zitadel/install-kubernetes` | Demonstrated search landings (`4` from `/technology/kube-vip`) and direct relevance to self-hosted cluster setup journeys. |
| 12 | Article refresh (organic winner) | Refresh `/read/building-rust-cue-library` | `rust cue library`, `cuengine rust` | Refresh article + code sample updates | `/technology/cue` | Healthy search traffic (`3`/`3`) and strong audience fit for platform automation builders. |
| 13 | Learning path / comparison | New comparison: FluxCD vs ArgoCD for platform teams | `fluxcd vs argocd`, `gitops tool comparison` | New comparison page | `/read/fluxcd-the-inevitable-choice` | Existing Flux opinion piece already gets search demand; comparison intent is a high-conversion adjacent query class. |
| 14 | Video companion piece | Companion article for `/watch/build-a-production-ready-kubernetes-cluster-with-spectro-cloud-palette-no-code-tutorial` | `spectro cloud palette tutorial`, `no code kubernetes cluster` | New article companion | `/watch/build-a-production-ready-kubernetes-cluster-with-spectro-cloud-palette-no-code-tutorial` | Search watch signal (`2`) with clear platform provisioning buyer intent. |
| 15 | Technology hub improvement | Upgrade `/technology/flatcar` | `flatcar linux kubernetes`, `immutable kubernetes os` | Hub improvement + decision matrix snippet | `/watch/flatcar-linux-a-modern-os-for-the-always-on-infrastructure` | Existing search traffic (`3`) and reinforcing signal from watch entry path for Flatcar. |
| 16 | Learning path / comparison | New comparison: Kairos vs Flatcar vs Talos | `kairos vs flatcar vs talos`, `immutable kubernetes os comparison` | New comparison page | `/technology/flatcar` | Supported by Kairos and Flatcar watch/technology signals; fills an explicit high-intent decision gap. |
| 17 | Video companion piece | Companion article for `/watch/crossplane-in-action` | `crossplane tutorial`, `crossplane platform engineering` | New article companion | `/watch/crossplane-in-action` | Search watch demand (`1`) but very high commercial/platform-intent keyword class. |
| 18 | Technology hub improvement | Upgrade `/technology/devspace` | `devspace kubernetes`, `inner loop kubernetes dev` | Hub improvement + workflow examples | `/learning-paths/build-your-first-kubernetes-developer-platform` | Existing search signal (`3`) and likely high activation potential when routed into guided path content. |
| 19 | Learning path / comparison | New comparison: Kyverno vs OPA Gatekeeper vs Kubewarden | `kyverno vs gatekeeper`, `kubernetes policy engine comparison` | New comparison page | `/learning-paths/mastering-kubernetes-security-posture-and-policy` | Existing Kyverno article traction plus security learning path destination gives immediate internal conversion target. |
| 20 | Learning path / comparison | New page: Platform engineering CI/CD stack (Dagger vs GitHub Actions vs GitLab CI) | `dagger vs github actions`, `gitlab ci vs github actions for platform teams` | New comparison page | `/read/dagger-gitlab-cloudflare-deployment` | Dagger deployment article appears in search entries; comparison intent expands capture for tool-selection queries. |

## Cadence and Owner Model

### Publishing Cadence (10 Weeks)
- Throughput: `2` backlog items published per week.
- Weekly split:
  - Slot A (Tuesday): refresh or hub improvement.
  - Slot B (Thursday): net-new companion or comparison page.
- Sequence:
  - Weeks 1-2: ranks `1-4`.
  - Weeks 3-5: ranks `5-10`.
  - Weeks 6-8: ranks `11-16`.
  - Weeks 9-10: ranks `17-20` + one optimization pass on ranks `1-5` (metadata/internal-link tuning).

### Owner Model
- Content strategy owner (DRI): Growth Lead (owns prioritization and KPI tracking).
- Technical accuracy owner: Domain SME per item (tool maintainer/host/reviewer).
- Production owner: Content Editor (brief to publish pipeline, QA, metadata consistency).
- Distribution owner: Platform Marketing (newsletter/social repackaging from published URL).
- Analytics owner: Data/SEO Analyst (weekly report on search-entry pageviews, assisted conversions, and internal-link CTR).

### Workflow SLA per Item
- Brief approval: 1 business day.
- Drafting: 2-3 business days.
- Technical review: 1 business day.
- SEO/metadata QA + publish: 1 business day.

## Complete Briefs (Top 3 Priorities)

### Brief 1: Refresh `/read/introducing-technology-matrix` (Rank 1)
- Goal: Increase qualified organic entry for matrix-intent terms and improve click-through to technology hubs.
- Primary query: `technology matrix`.
- Secondary queries: `cloud native technology matrix`, `platform engineering radar`.
- Audience: Platform engineers and tech leads evaluating tooling choices.
- Search intent: Informational with strong navigational follow-up.
- Target URL: `/read/introducing-technology-matrix`.
- Primary internal-link destination: `/technology/matrix`.
- Required updates:
  - Refresh intro for 2026 positioning and intent fit.
  - Add section: "How to use the matrix for platform decisions".
  - Add section: "Top 5 matrix views for common platform goals".
  - Add explicit jump links to `/technology/matrix` and `/technology/matrix/advanced`.
  - Add FAQ block covering query variants above.
- Suggested title tag: `Technology Matrix for Cloud Native Platforms (2026 Guide)`.
- Suggested meta description: `Learn how to use Rawkode Academy's Technology Matrix to evaluate cloud native tools and choose the right platform engineering stack in 2026.`
- Schema: `Article` + `FAQPage`.
- CTA: "Explore the Technology Matrix".
- Success metrics (30d post-publish):
  - +30% search-entry pageviews to `/read/introducing-technology-matrix`.
  - Internal CTR to `/technology/matrix` >= 18%.
- Source signal basis: Search `6` pageviews / `5` users for article; matrix hub cluster leads technology search discovery.

### Brief 2: Upgrade `/technology/matrix` hub (Rank 2)
- Goal: Convert high-volume matrix landings into deeper cluster exploration and learning-path engagement.
- Primary query: `cloud native technology matrix`.
- Secondary queries: `platform engineering tool landscape`, `compare cloud native tools`.
- Audience: Engineering managers, staff+ platform engineers, architects.
- Search intent: Comparative evaluation.
- Target URL: `/technology/matrix`.
- Primary internal-link destination: `/technology/matrix/advanced`.
- Required updates:
  - Add above-the-fold explanation of scoring dimensions.
  - Add "Popular exploration paths" panel linking to high-intent technologies (kube-vip, devspace, flatcar, linkerd, falco).
  - Add quick filters aligned to decision scenarios (security, GitOps, developer experience, edge).
  - Add "Next step" module linking to `/learning-paths/build-your-first-kubernetes-developer-platform`.
  - Tighten metadata for matrix-focused search intent.
- Suggested title tag: `Cloud Native Technology Matrix: Compare Platform Engineering Tools`.
- Suggested meta description: `Compare cloud native technologies with Rawkode Academy's Technology Matrix and drill into advanced views for platform engineering decisions.`
- Schema: `CollectionPage` + `ItemList`.
- CTA: "Open Advanced Matrix".
- Success metrics (30d post-publish):
  - +20% pageviews to `/technology/matrix/advanced` from matrix hub.
  - +15% click-through to at least one specific `/technology/*` page.
- Source signal basis: `/technology/matrix` (`17` search + `21` YouTube referrer), `/technology/matrix/advanced` (`16` search).

### Brief 3: Refresh `/read/kyverno-cel-validating-policy` (Rank 3)
- Goal: Capture policy-engine decision traffic and route to security learning path.
- Primary query: `kyverno validatingpolicy`.
- Secondary queries: `kyverno cel`, `kubernetes validatingpolicy examples`.
- Audience: Platform security engineers and Kubernetes platform maintainers.
- Search intent: Implementation-oriented informational intent.
- Target URL: `/read/kyverno-cel-validating-policy`.
- Primary internal-link destination: `/learning-paths/mastering-kubernetes-security-posture-and-policy`.
- Required updates:
  - Update version references and release-status notes.
  - Add section: "Kyverno CEL vs native Kubernetes policy controls".
  - Add production-ready examples with clear copy/paste boundaries.
  - Add internal link module: Kyverno tech page and security learning path.
  - Add FAQ answering "when to use Kyverno vs alternatives".
- Suggested title tag: `Kyverno ValidatingPolicy with CEL: Practical Guide for Kubernetes`.
- Suggested meta description: `Implement Kyverno ValidatingPolicy with CEL using practical examples, performance guidance, and platform security best practices.`
- Schema: `Article` + `HowTo` (for policy rollout section).
- CTA: "Start the Kubernetes Security Learning Path".
- Success metrics (30d post-publish):
  - +25% search-entry pageviews to this article.
  - >= 12% CTR to security learning path destination.
- Source signal basis: `/read/kyverno-cel-validating-policy` has `4` search pageviews / `4` users and aligns with high-intent policy comparison demand.

## Notes
- This backlog intentionally avoids editing `content/articles/**`, `content/videos/**`, and `content/learning-paths/**` in this task.
- Implementation tasks should be spawned per backlog item with acceptance criteria tied to the above success metrics.
