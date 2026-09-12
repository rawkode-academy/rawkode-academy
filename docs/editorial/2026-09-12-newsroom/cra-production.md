# CRA Reporting Begins: Production Package

Status: Independently Fact-Checked; Awaiting Recording Review. Prepared 12 September 2026.

## Editorial Position

An incident handoff exercise makes the reporting deadline concrete for platform engineers at manufacturers in scope. Do not frame this as a universal requirement for Kubernetes users or OSS contributors. The counterargument is that extra workflow can slow incident response; the proposed exercise should improve existing ownership rather than create a new bureaucracy.

Format: Practical Explainer, Approximately Six Minutes. Runtime depends on delivery and screen pauses.

Working titles:

- The CRA Reporting Clock Has Started: Is Your Team Ready?
- 24 Hours To Warn: Test Your Incident Handoff

Thumbnail: David beside two clearly labelled clocks, "Awareness + 24h" and "Awareness + 72h". Add the caption "Initial Deadlines; Further Reporting Applies". Small qualifier: "Manufacturers In Scope". No countdown implying every viewer has a current deadline.

## Full Spoken Script

### 00:00–00:40 | Hook

Your incident dashboard can be green while your incident process is completely unprepared for a reporting deadline. That is the question I would ask after this week's Cyber Resilience Act milestone: if evidence of a qualifying event arrived now, could the right people recognise it, assess it, and prepare the notification in time?

On the eleventh of September, ENISA announced the launch of the initial operating capability of its Single Reporting Platform. Manufacturer reporting obligations began on the same date. Let's work through what that means for an engineering team, and where the boundaries matter. [S1]

### 00:40–01:30 | Scope Before Panic

First, this is about manufacturers and products within the scope of the legislation. The fact that you run Kubernetes, publish code, or maintain a dependency is not enough to decide your role.

The Commission describes a specific approach to open source. Commercially supplied products, contributions to projects outside your responsibility, and open-source software stewards are distinct cases. Those categories need care. Do not assume that every contributor is a manufacturer, or that an open-source licence automatically removes manufacturer obligations. [S2]

The reporting obligations for open-source software stewards under Article twenty-four, paragraph three, begin on the eleventh of December, twenty twenty-seven. Establish your organisation's position with the people responsible for that assessment. This video cannot classify an individual company from its technology stack. [S3]

### 01:30–02:20 | Two Deadlines, One Starting Point

For qualifying actively exploited vulnerabilities and severe incidents, the early warning must be made without undue delay and within twenty-four hours of awareness. The more detailed notification must follow without undue delay and within seventy-two hours of awareness, unless the relevant information has already been provided. Both run from awareness. Sending the first notification does not buy you another seventy-two hours. These are initial deadlines; further reporting requirements also apply. [S4]

These are not instructions to upload every scanner result. There are defined reporting triggers. A vulnerability report, evidence of exploitation, and a severe product security incident need appropriate assessment.

For today's exercise, we will assume the responsible team has established that the synthetic event is reportable. We are testing what happens next, without pretending to settle the legal threshold on a whiteboard.

### 02:20–03:30 | Run The Exercise

Here is our fictional scenario. We make a product called Example Gateway. A report arrives containing evidence of unauthorised exploitation. Every name and every detail on screen is invented.

I want one person to describe how that information enters the organisation. Is it a monitored security address, a support ticket, or a message to a maintainer? Then ask who can establish which product versions are affected. That might need an engineer, release metadata and someone who understands the supported configurations.

Next, identify the person responsible for assessing the reporting obligation, and the person who prepares and submits the notification. They may be different people. Give each a deputy.

Now repeat the exercise with the first person unavailable. Imagine the evidence arrives outside your normal working hours. Where does it wait? Which handoff depends on someone knowing the right name? Those are the gaps I would fix first.

### 03:30–04:30 | Capture Useful Evidence

Our exercise record has a few simple fields: when information arrived, what it says, what remains uncertain, which product may be affected, the current owner, and the next action. This is an internal exercise template, not ENISA's notification form.

Keep facts and working hypotheses separate. If the affected versions are still being investigated, say so. Do not turn a guess from an incident channel into a confident statement because a form needs text.

Have the responsible reporting team compare its information needs with the official guidance. Engineers should be able to supply useful evidence without having to reconstruct every decision from chat history. My recommendation is to test that handoff before investing in an integration. If the ownership is unclear, automation will not resolve it.

### 04:30–05:20 | Prepare Access Carefully

There is also a specific preparation detail worth getting right. ENISA's guidance says reporting representatives need a personal EU Login account with multi-factor authentication. That can be prepared in advance. It currently advises registering and initiating validation on the reporting platform only when a notification is needed. So the action here is to read the current guidance and prepare the people and access requirements, rather than encourage everyone to create speculative manufacturer registrations. [S5]

For this video we are using public guidance and fictional records. We will not submit a test incident to the production platform. You can learn a lot about your handoffs without sending anything externally.

### 05:20–06:00 | Takeaway

The objection I expect is that this adds bureaucracy to an already stressful incident. It can, if you create a separate process nobody understands. My preference is to start with your existing incident response and test where reporting responsibilities fit.

Pick a synthetic scenario. Follow it through the real ownership chain. Find the first missing person, missing piece of evidence, or unclear decision. Fix that, then run it again.

For manufacturers in scope, the reporting milestone is now operational. The useful engineering question is whether your organisation can turn an incoming report into a timely, accurate response. That is the exercise I would run this week.

## Timed Storyboard

| Time | Picture And Action | On-Screen Text | Purpose |
| --- | --- | --- | --- |
| 00:00–00:40 | Presenter; cut to dated ENISA announcement | 11 September 2026; Initial Operating Capability | Establish the fresh event without implying full CRA implementation |
| 00:40–01:30 | Three simple cards for manufacturer, contributor and steward; highlight scope qualifier | Role And Product Scope Matter; Stewards: 11 December 2027 | Prevent blanket claims about OSS |
| 01:30–02:20 | Timeline with a shared awareness origin and two markers | Without Undue Delay; Within 24h / Within 72h Of Awareness | Prevent resetting the second clock |
| 02:20–03:30 | Presenter opens fictional incident worksheet; fills owner and deputy fields | Fictional Exercise: Example Gateway | Make the operational gap visible |
| 03:30–04:30 | Zoom to facts, hypotheses and next action fields | Internal Exercise Record, Not Official Form | Separate exercise design from legal notification requirements |
| 04:30–05:20 | Show ENISA FAQ account guidance; highlight EU Login and timing advice | Prepare EU Login + MFA; Check Current Registration Guidance | Avoid premature registration advice |
| 05:20–06:00 | Presenter; return to worksheet with one ownership gap repaired | Test The Handoff; Fix The First Gap | Leave viewers with a bounded action |

## Demo Assets And Prerequisites

- Prepare a local worksheet with fictional product, timestamps, evidence summary, uncertainty, owner, deputy and next action. Do not depict it as an official SRP form.
- Capture public ENISA and Commission pages on recording day. Keep source URL and date visible in crops.
- Build the two-marker timeline with an explicit shared awareness origin. Treat 24h and 72h as outer deadlines, not suggested waiting periods.
- No cluster, real vulnerability, production credentials, regulatory account or external submission is required.
- Recording fallback: replace unavailable public pages with simple source-linked text cards based on the verified claims. Do not recreate unverified portal UI.

## Sources And Claim Map

S1: [ENISA Launch Announcement](https://www.enisa.europa.eu/news/the-cra-single-reporting-platform-is-launched), published 11 September 2026. Establishes launch as initial operating capability, manufacturer start and planned future platform improvements.

S2: [Commission Open-Source Guidance](https://digital-strategy.ec.europa.eu/en/policies/cra-open-source), last updated 31 July 2026. Background source, not a fresh announcement. Establishes distinct manufacturer, contributor and steward treatment.

S3: [Commission Reporting Guidance](https://digital-strategy.ec.europa.eu/en/policies/cra-reporting), reviewed 12 September 2026. Establishes manufacturer and steward reporting commencement dates. Do not label this page as newly published on 11 September.

S4: [CRA Legal Text](https://eur-lex.europa.eu/eli/reg/2024/2847/oj/eng), Article 14, with [ENISA Reporting FAQ](https://www.enisa.europa.eu/topics/product-security/single-reporting-platform-srp/frequently-asked-questions), question 7, updated 11 September 2026. Supports awareness-based deadlines and trigger distinction. The final-report stage exists but is outside this short explainer's focus; this is not a complete procedural guide.

S5: [ENISA Reporting FAQ](https://www.enisa.europa.eu/topics/product-security/single-reporting-platform-srp/frequently-asked-questions), question 9. Supports personal EU Login, MFA and registration timing advice. Recheck before recording because operational guidance may change.

## Recording And Editorial Checklist

- Confirm dates, deadline origin and scope qualifiers survive captions, cuts and thumbnail editing.
- Retain "without undue delay" alongside the 24h and 72h limits.
- Keep synthetic incident records visibly fictional and local.
- Do not imply the platform launch proves security effectiveness or that the entire CRA applies now.
- Do not classify a named organisation or project as a manufacturer or steward without separate assessment.
- Recheck operational account guidance before recording.
- Route any new substantive claim or example presented as real through independent fact-checking.
- Runtime estimate is an editorial estimate; rehearse and adjust pacing without deleting scope qualifications.

## Verification Status

Primary pages reopened on 12 September 2026. High confidence in dates, launch status and deadlines. Organisation-specific applicability is unresolved by design. The handoff exercise, worksheet fields and prioritisation are editorial recommendations, not claims that the CRA mandates that exact workflow. Await independent final copy review.
