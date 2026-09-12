# Rawkode Academy Guest Briefs

Prepared 12 September 2026. These are research and invitation drafts only. Nobody has been contacted. Availability, willingness to demonstrate, and any speaking restrictions remain unconfirmed. Guest recommendations are editorial judgements; affiliations and involvement below are source-verified.

## 1. Neil Cresswell: The Portainer Community Edition Decision

**Priority:** First podcast/interview invitation. The product decision-maker can answer the central unresolved questions in the lead story.

**Verified identity and involvement:** Neil Cresswell identifies himself as Portainer CEO in his 11 September announcement. He is its named author. [Announcement](https://www.portainer.io/blog/portainer-3-0-is-coming).

**Existing relationship:** Verified returning guest. Rawkode Academy lists a Portainer hands-on appearance on 15 October 2022 and the inaugural Cloud Native Compass episode on 21 May 2023. The local content records corroborate both. [Guest profile](https://rawkode.academy/people/ncresswell), [2022 session](https://rawkode.academy/watch/hands-on-introduction-to-portainer), [2023 discussion](https://rawkode.academy/watch/cloud-containers-and-kubernetes).

**Public professional contact:** [Neil's GitHub profile](https://github.com/ncresswell) and [public X profile](https://x.com/NeilC_Cloud), both linked by Rawkode Academy's existing guest record. Use David's established channel if he has one; none was accessed in this research. No guessed email address.

**Why now:** The announcement places CE on the 2.x codebase while the planned 3.x line adopts a Kubernetes-first direction. Late-September 3.0 and future maintenance are vendor commitments, not completed releases verified here.

**Format and thesis:** 40-minute recorded interview, with a separate feature demo only after the relevant build is available and rehearsed. Working title: **“Portainer's Kubernetes Future: What Does The Community Keep?”** Thesis: test the engineering case for the split against the upgrade, maintenance and control requirements of existing users.

**Five questions:**

1. Your 2022 appearance presented a universal container management console. Which specific architectural constraints now make maintaining that approach untenable, and what would it cost to retain it?
2. What is the minimum supported lifetime for CE 2.x, who owns security triage, and will those commitments become a written support policy?
3. Which capabilities and deployment rights will differ between CE 2.x and the three-nodes-free 3.x offer, including disconnected installations and installations that exceed the free limit?
4. Your announcement says native Docker, Swarm and Podman environments remain operable in 3.x. Which compatibility tests will protect existing workflows as Kubernetes-only features grow?
5. For a team choosing to migrate, which Compose semantics and operational assumptions cannot be preserved by D2K, and what does a tested rollback actually involve?

**Demo outline:** Start with a small existing Compose application and a recorded inventory of volumes, networking and secrets. Ask the engineering team to select a currently available D2K build and show both a successful translation and an unsupported case. Compare resulting Kubernetes resources and ownership. Finish by restoring the original environment. This is a proposed demonstration, not a verified compatibility claim. Obtain version pins and rehearse before announcing it; do not promise an unreleased 3.0 demo.

**Counterargument:** Maintaining separate platform backends can consume engineering effort and slow development. A serious interview must test that explanation without presuming bad faith or implying Docker support disappears overnight.

**Invitation draft:**

Hi Neil,

I'd like to have you back on Rawkode Academy following your Portainer 3.0 announcement. In our 2022 hands-on session we explored Portainer as a universal management console, and in the first Cloud Native Compass episode we discussed Docker trust and developer portals. This feels like the right moment to revisit those decisions.

Could we record a 40-minute conversation about why the architecture is changing, what CE users can rely on, and the practical trade-offs of the Kubernetes path? I'd particularly like concrete answers on 2.x maintenance and the differences in the free 3.x offer. We could arrange a separate D2K demo with an engineer once we've agreed a reproducible example, including a migration limitation and rollback.

Would you be interested?

David

**Verification note:** High confidence in identity, announcement authorship and previous appearances. Product delivery, CE maintenance duration, detailed licensing and demo compatibility require answers or additional artefacts. Do not present Portainer's claims about Docker's future as established facts.

## 2. Richa Banker: A Native Histograms Migration Livestream

**Priority:** Best feature-focused livestream prospect. She has direct implementation involvement, beyond writing about the feature.

**Verified identity and involvement:** Richa Banker is listed as a Google-affiliated SIG Instrumentation chair in the [official SIG leadership record](https://github.com/kubernetes/community/blob/main/sig-instrumentation/README.md). She authored and is assigned [KEP-5808's tracking issue](https://github.com/kubernetes/enhancements/issues/5808), and authored the [API server implementation PR #136763](https://github.com/kubernetes/kubernetes/pull/136763). She is the bylined author of the [11 September feature article](https://kubernetes.io/blog/2026/09/11/kubernetes-v1-37-native-histograms-beta/).

**Existing relationship:** No exact-name match found in the checked Rawkode repository and no confirmed appearance found in the public search. This is not proof she has never appeared. Relationship status remains unknown.

**Public professional contact:** [GitHub profile](https://github.com/richabanker), linked by the SIG record. The SIG also publishes its [community Slack contact](https://kubernetes.slack.com/messages/sig-instrumentation). Use these to locate an appropriate professional invitation channel, not to post unsolicited invitations into technical issues. No message has been sent.

**Why now:** The 11 September article offers new migration guidance for beta native histogram support in Kubernetes v1.37. Do not describe 11 September as the original v1.37 release date. The useful story is the collector, dashboard and alerting migration, including retaining classic series during transition.

**Format and thesis:** 60-minute technical livestream. Working title: **“Kubernetes Native Histograms: Migrate The Metrics, Keep The Alerts”**. Thesis: prove the end-to-end transition and expose what a default-enabled producer feature does not automatically solve for collectors and queries.

**Five questions:**

1. What did you change in component-base and API server registration, and why did registering metrics during init complicate feature-gate behaviour?
2. Which producer, Prometheus and remote-write/backend versions should operators verify before collecting native histograms, and what happens when one layer cannot handle them?
3. How do we preserve classic dashboards and alerts during migration, and how should we test both query paths before stopping classic ingestion?
4. What trade-offs arise from the bucket factor and bucket-count cap, particularly with outliers or schema changes, and which quantile accuracy statements are safe to make?
5. How should we measure series count, bytes stored, scrape payload and CPU independently, and what evidence would make you recommend postponing migration?

**Demo outline:** Pin a supported Kubernetes and Prometheus combination with Richa before recording. Begin with classic API server latency panels and a known alert. Collect native histograms alongside classic series; compare a single-target query, then aggregate across API server instances. Remove classic ingestion in the disposable lab to expose a stale classic query, restore it, and migrate that query. Finish with measured series counts and a rollback. Show remote-write or backend handling only if it has been rehearsed. Keep test traffic bounded and use authenticated, certificate-verified metrics access.

**Counterargument:** Fewer time series is not automatically a matching reduction in storage bytes, memory or bills. Dual collection temporarily keeps both representations, and real cost and accuracy improvements depend on the distribution and telemetry pipeline. The official article's broad savings and accuracy claims are questions to examine, not benchmark results produced by Rawkode Academy.

**Invitation draft:**

Hi Richa,

Your native histograms article and work on KEP-5808 look like a great fit for a hands-on Rawkode Academy livestream. I'd like to work through the migration with someone who built it: keeping classic alerts alive, querying the native representation, and understanding the registration changes behind the feature.

Would you join me for a 60-minute session using a disposable Kubernetes and Prometheus setup? I'd like viewers to see a query migration, a deliberate compatibility failure and rollback, plus a measured comparison that separates series count from storage cost. We can agree the version pins and rehearse the example in advance.

David

**Verification note:** High confidence in name, Google affiliation, SIG role and direct feature implementation involvement. Demo versions and results are unverified proposals. The PR confirms implementation authorship; the beta state is supported by the tracking issue and official article. Do not repeat the article's “10x storage” wording as a measured result.

## 3. Ciarán O'Riordan: Who Actually Has CRA Reporting Duties?

**Priority:** Focused policy podcast to accompany the CRA article. Prefer an expert discussion of scope and upstream/downstream responsibilities to a generic compliance pitch.

**Verified identity and involvement:** Ciarán O'Riordan is the Eclipse Foundation's Director of European Policy in its [staff directory](https://www.eclipse.org/org/foundation/staff/) and [individual profile](https://accounts.eclipse.org/users/ciaran). Eclipse's [19 December 2023 CRA account](https://eclipse-foundation.blog/2023/12/19/good-news-on-the-cyber-resilience-act/) explicitly credits his coordination of open-source community input while at OpenForum Europe. That historical article verifies involvement only; its then-current forecasts must not be used for today's obligations.

**Existing relationship:** Not established. Do not claim either a first appearance or a prior relationship.

**Public professional contact:** [Official Eclipse profile](https://accounts.eclipse.org/users/ciaran). Eclipse's [10 September toolkit announcement](https://newsroom.eclipse.org/news/announcements/eclipse-foundation-releases-free-toolkit-help-smes-prepare-eu-cyber-resilience) publishes professional media contact routes for requesting an interview. Do not infer an email from the staff naming convention.

**Why now:** The Commission's reporting page was updated on 11 September, when manufacturer reporting obligations began. It expressly places open-source steward reporting under Article 24(3) on 11 December 2027. [Current reporting guidance](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting), [current open-source scope guidance](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source). Eclipse's toolkit announcement on 10 September is supporting context, outside a strict first-run 24-hour window, not a newly released story today.

**Format and thesis:** 35-minute podcast, with a short tabletop segment. Working title: **“The CRA Reporting Clock: Who Is Responsible For An Open-Source Product?”** Thesis: give experienced developers precise distinctions between contributors, stewards and manufacturers, then map an incident to responsibilities without suggesting every OSS maintainer acquired a reporting duty on 11 September.

**Five questions:**

1. How should a company using and distributing an open-source component distinguish the contributor, steward and manufacturer roles, and where do practitioners most often misclassify themselves?
2. What separates an actively exploited vulnerability or severe incident from a scanner finding, and what evidence should a manufacturer preserve when establishing awareness?
3. Which responsibilities belong in engineering incident response, which require a designated reporting owner, and how should a team operate against the 24-hour early-warning and 72-hour notification deadlines?
4. How should manufacturers coordinate with upstream projects while protecting sensitive vulnerability information, and what must they avoid demanding of volunteer maintainers?
5. What changes for stewards in December 2027, what preparatory work is useful now, and where does current guidance still leave a genuine interpretation question?

**Tabletop outline:** Use a fictional commercial software product that includes an OSS dependency. Present an ordinary scanner finding, then a separate confirmed exploitation report. Ask Ciarán to identify the facts needed to classify the situation and the responsible actors. Build an awareness and escalation timeline on screen, distinguish the initial warning from follow-up notification, and compare it with a volunteer upstream contributor's role. No real reporting-platform submission, organisation-specific legal conclusion or guarantee of compliance. Have the guest review the scenario before recording.

**Counterargument:** Applicability is fact-specific. A simplified decision tree can obscure commercial activity and product responsibility. Keep uncertainty visible, and do not imply an SBOM alone proves compliance or that adopting a toolkit resolves legal scope.

**Invitation draft:**

Hi Ciarán,

I'd like to invite you onto Rawkode Academy for a practical conversation about the CRA reporting obligations that began on 11 September. Your work coordinating open-source community input, and your European policy role at Eclipse, make you a strong person to help our developer audience separate manufacturer responsibilities from contributor and steward responsibilities.

Could we record a 35-minute discussion around a fictional vulnerability incident? I'd like to establish which facts matter, who owns escalation and reporting, and how companies can cooperate with upstream projects without pushing their obligations onto volunteers. We would also clearly distinguish this September's manufacturer duties from the steward reporting date in December 2027.

Would that be of interest?

David

**Verification note:** High confidence in identity, current policy role, documented historical CRA involvement and the Commission's stated reporting dates. No claim that Ciarán personally built the September toolkit or speaks on behalf of a regulator. Availability and case-specific legal interpretation remain unconfirmed.
