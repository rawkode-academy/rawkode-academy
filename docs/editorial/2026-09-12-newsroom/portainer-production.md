# Portainer 3.x Production Package

Status: Independently fact-checked; awaiting recording review. Outreach and publication have not occurred; this package is for review. Source cutoff: 12 September 2026. This develops the already briefed 11 September event; it is not a new alert.

## Format And Position

Opinionated video, approximately 7 minutes including source pauses. Audience: platform engineers and experienced Docker/Kubernetes operators. Thesis: assess the future edition, maintenance and runtime choices separately. Strong counterargument: focusing engineering on Kubernetes can make a coherent product; continued 2.x maintenance gives existing users time.

Working titles:

- Portainer 3.x Has No Separate Community Edition. What Now?
- Should Portainer's Kubernetes Roadmap Change Your Platform?

Thumbnail options: “CE STAYS ON 2.x” beside David and a neutral 2.x/3.x comparison; “YOUR NEXT MOVE?” over three labelled cards: Maintain, Upgrade, Reassess. Avoid “Docker Is Dead”, “Forced Migration” and “CE Deleted”.

## Full Spoken Script

### 00:00–00:45 | The Decision

Portainer's next major version changes the question for Community Edition users. You need to work out which edition you can move to, which features your environment will get, and how long staying where you are remains a sensible choice.

Here is my position: a vendor choosing Kubernetes should make you review your platform. It should not automatically make you migrate your applications. Your workload still needs to justify the operational change.

Let's separate what Portainer announced, what it has promised, and what I think operators should do with that information.

### 00:45–01:40 | What Was Announced

On the eleventh of September, Portainer CEO Neil Cresswell announced the direction for version three. The company plans three point zero at the end of September as an STS release, with three point three LTS planned for December. Those are future release plans in the announcement. This is not a hands-on review of a finished three point zero release.

The headline for Community Edition users is straightforward. CE continues on the two point x codebase. It will not receive the three point x changes, and Portainer is not producing a separate CE build of version three.

Portainer says it will maintain two point x with security updates, bug fixes and selected backports. That is useful. The announcement does not give that maintenance an end date, so the duration remains an important question to put to the company.

### 01:40–02:35 | Docker Still Works, But The Roadmap Splits

There is another distinction that can disappear in the headline. Portainer says native Docker, Swarm and Podman environments will still be available in version three. They can still be operated through its interface.

But those environments will not receive the new capabilities being developed for the policy, GitOps and observability layers. That creates a difference between a workflow continuing to function and that workflow continuing to benefit from the product's investment.

For your team, the useful question is which capabilities you actually need. If today's feature set solves the problem, remaining on a maintained release may be reasonable. If your roadmap depends on new policy or operational features, investigate where those features will be available before choosing the next edition or version.

### 02:35–03:30 | The Free Programme Is A Different Route

Portainer points the community towards its three-nodes-free programme for version three. The programme page says you receive a Business Edition licence, with one licence per organisation.

The linked agreement matters too. The version currently linked, last modified in July twenty twenty-three, sets a limit of one server instance and three total nodes, including the server instance. Read the applicable terms and confirm the counting against your own deployment.

This is why I would not turn “free for the community” into a blanket assurance that every existing user's next upgrade looks the same. A separate Community Edition and a limited Business Edition programme are different offers. The practical impact depends on your estate and the terms you need. Establish that before planning around it.

### 03:30–04:25 | The Strongest Case For Portainer's Decision

There is a defensible engineering argument here. Portainer says maintaining functionality across Docker, Swarm and Kubernetes has become too costly within its existing codebase. Concentrating on Kubernetes is intended to let it build deeper capabilities and more specialised consoles.

I can understand that choice. A product team has finite time, and a coherent platform can be more valuable than broad support with awkward compromises. That is an argument for Portainer's product strategy.

The argument you need to make inside your own organisation is different. Will changing the runtime improve the applications you operate? Which requirements does it satisfy? Who will own the resulting system? A vendor can make a rational choice for its engineering team without that choice being the best migration plan for yours.

### 04:25–05:35 | A Practical Review

I would start with a small inventory. Record your Portainer edition, the environments it manages, the workflows people actually use and the features you are waiting for. Include the administrative work that has become invisible because it is routine.

Next, write down the maintenance commitment your organisation requires. Ask Portainer how that maps to the two point x commitment. An unspecified end date is an unanswered planning question. It is not evidence of either immediate abandonment or indefinite support.

Then compare your options against those requirements. Staying on a maintained two point x deployment is one option. Evaluating version three under suitable terms is another. Reassessing the management layer is also legitimate.

If Kubernetes is part of that evaluation, give it a workload-specific justification and test your critical workflows before changing production. None of that requires an emergency migration based on this announcement.

### 05:35–06:25 | Questions Worth Answering Next

The interview I want is about commitments and operational boundaries. What maintenance horizon can CE users plan around? How should an existing community deployment beyond the free programme's limits evaluate its next step? Which new capabilities will make Kubernetes worth the transition for a satisfied Docker operator?

Those are answerable questions. They give users more than a fight about whether one runtime has won.

My recommendation is to review the roadmap now, while the next release is still planned. Keep the edition decision, the management-tool decision and the runtime decision explicit. Your applications and your operators should determine how those decisions come together.

## Timed Storyboard

Times are edit targets. Allow approximately 35 seconds of source-reading pauses across the sequence for a 7-minute cut; adjust after the read-through.

| Time | Picture And Action | Evidence / Production Note |
| --- | --- | --- |
| 00:00–00:45 | David to camera; reveal three labels: Edition, Maintenance, Runtime. | Opinion labelled through spoken first person. |
| 00:45–01:40 | Open the CEO announcement; show publication date, then the CE section; return to David for maintenance question. | Caption “Announced 11 September 2026; 3.0 Planned”. Avoid suggesting an available release. |
| 01:40–02:35 | Recreated comparison table: native environments retained / new named capabilities focused on Kubernetes. | Label “According To Portainer's Announcement”. Do not show an invented 3.x interface. |
| 02:35–03:30 | Show programme page, then agreement date and clause 1. | Keep source URL readable. Crop contact forms; no signup. |
| 03:30–04:25 | David to camera with two cards: Portainer's Engineering / Your Operational Requirements. | Treat costs and benefits as rationale and evaluation questions. |
| 04:25–05:35 | Fill a fictional inventory: edition, environment, critical workflow, required maintenance horizon. | “Illustrative Review Template”. No customer details or claimed test results. |
| 05:35–06:25 | Show three interview questions; finish on links to the article and official sources. | Invitation has not been sent; no guest appearance implied. |
| Added Pauses | Hold source sections and inventory for approximately 35 seconds total. | Final target around 7:00; do not stretch silence artificially. |

## Recording Prerequisites And Fallback

Required: microphone/camera, browser capture with personal tabs hidden, official pages reopened immediately before recording, a plain comparison slide and an illustrative inventory sheet. No cluster, vendor account or licence registration is needed for this source walkthrough.

Fallback: if a source is unavailable, use a previously captured excerpt with its capture date and URL, and disclose that current wording could not be rechecked. If a release or policy changes, pause the affected passage and send the revision through fact-checking. Do not use a mock product screen as evidence.

Optional future technical follow-up: after suitable release availability and terms are checked, test a disposable environment with representative workflows. Define expected behaviour, backup/restore and permissions checks first. This package contains no executed demo and makes no compatibility or performance claim.

## Recording And Publication Checklist

- Recheck 3.0 release status and all three linked policy pages; refresh dates and route new factual claims back through independent review.
- Keep native Docker/Swarm/Podman retention and absence of a separate CE3.x explicit.
- Attribute maintenance and feature-roadmap promises to Portainer.
- Preserve the free programme's organisation and node limits; do not claim universal equivalence with CE.
- Confirm no invented benchmarks, migration results, screenshots or guest participation.
- Read aloud for timing, check subtitles and source URLs, and ensure the final video stays below ten minutes.

## Source Ledger

| Source | Date | Supports | Limitation |
| --- | --- | --- | --- |
| [CEO Announcement](https://www.portainer.io/blog/portainer-3-0-is-coming) | Published 11 September 2026 | Planned releases; CE path; maintenance promise; native environments; feature direction | Vendor statement; future delivery unverified. Firecrawl supplied a cached 12 September 03:15 UTC copy. |
| [Three Nodes Free](https://www.portainer.io/take-3) | Checked 12 September 2026; no publication date shown | Business Edition licence; one licence per organisation | Programme terms can change. |
| [Licence Agreement](https://www.portainer.io/legal/3nf-license-agreement) | Last modified 6 July 2023; checked 12 September 2026 | One server and three total nodes including server | Linked current text, not a legal interpretation of a particular user's rights. |
| [Release Notes](https://docs.portainer.io/release-notes) | Latest heading observed 2.45.0, 27 August 2026 | Background freshness check only | Cached 10 September copy; cannot prove no newer release. No vulnerability claims reused. |

Targeted freshness search found the same announcement and community discussion, with no independently verified substantive Portainer delta. That narrow check is not a claim of comprehensive ecosystem coverage.
