# Growth Funnel Dashboard Plan

This PR defines the first practical `activated_user` event for the website analytics layer and prepares the first PostHog dashboard around it.

## First practical activation definition

For this first slice, treat a user as **activated** when they complete a high-intent learning conversion on the website:

1. `lead_magnet_signup`
   - currently the Kubernetes 1.35 cheat sheet unlock flow
   - emitted as canonical `activated_user` when the newsletter subscription succeeds from the `lead-magnet` surface and is not a duplicate subscription
2. `course_signup`
   - emitted as canonical `activated_user` when a course updates signup succeeds

This deliberately does **not** count every generic newsletter subscription as activation.
That keeps the funnel meaningful:

- visitor → subscriber
- subscriber/learner → activated user via a stronger learning-intent action

## Canonical event

### Event name

- `activated_user`

### Event properties

Common properties expected on `activated_user`:

- `distinct_id`
- `is_authenticated`
- `source`
- `source_system`
- `source_surface`
- `source_context`
- `page_path`
- `activation_trigger`
- `activation_surface`

Additional properties by trigger:

#### Lead magnet activation

- `audience`
- `channel`
- `subscriber_type`
- `lead_magnet` when present via source context
- `activation_trigger = "lead_magnet_signup"`
- `activation_surface = "lead-magnet"`
- `activation_context = <lead magnet id>`

#### Course activation

- `audience_id`
- `allow_sponsor_contact`
- `activation_trigger = "course_signup"`
- `activation_surface = "course_signup"`
- `source = "website:course-signup:<courseId>:<pagePath>"`

## Dashboard to create in PostHog

### Dashboard name

- `Growth Funnel`

### Time range

- last 90 days by default

### Filters

- environment: production only
- exclude internal/test users if a property or cohort exists later

## Insights

### 1. Funnel — Visitor to Activated User

**Type:** Funnel

**Steps:**
1. `page_view`
2. `newsletter_subscribed`
3. `activated_user`

**Count mode:** unique users

**Conversion window:** 30 days

**Breakdowns to save:**
- `source_surface`
- `page_path`
- `source_context`

### 2. Funnel — Visitor to Registered to Activated

**Type:** Funnel

**Steps:**
1. `page_view`
2. `sign_in_completed`
3. `activated_user`

**Count mode:** unique users

**Conversion window:** 30 days

**Breakdowns:**
- `activation_trigger`
- `activation_surface`
- `page_path`

### 3. Trend — Activated users per week

**Type:** Trends

**Series:**
- `activated_user`

**Interval:** weekly

**Math:** unique users

**Breakdowns:**
- `activation_trigger`

### 4. Table — Top activation pages

**Type:** Trends / Table

**Event:** `activated_user`

**Math:** unique users

**Breakdown:**
- `page_path`

**Sort:** descending

### 5. Table — Top activation contexts

**Type:** Trends / Table

**Event:** `activated_user`

**Math:** unique users

**Breakdown:**
- `activation_context`
- fallback/additional: `audience_id`

### 6. Funnel — Page view to Course signup

**Type:** Funnel

**Steps:**
1. `page_view`
2. `course_signup`

**Count mode:** unique users

**Breakdown:**
- `source_context`
- `page_path`

### 7. Funnel — Page view to Lead magnet activation

**Type:** Funnel

**Steps:**
1. `page_view`
2. `activated_user`

**Filters:**
- `activation_trigger = "lead_magnet_signup"`

**Breakdown:**
- `activation_context`
- `page_path`

## Useful PostHog filters / query notes

### Activated users only

- event: `activated_user`

### Course activations only

- event: `activated_user`
- where `activation_trigger = "course_signup"`

### Lead magnet activations only

- event: `activated_user`
- where `activation_trigger = "lead_magnet_signup"`

### Top course landing pages by activation

- event: `activated_user`
- where `activation_trigger = "course_signup"`
- breakdown by `page_path`

### Top lead magnets by activation

- event: `activated_user`
- where `activation_trigger = "lead_magnet_signup"`
- breakdown by `activation_context`

## Why this first slice is intentionally narrow

This is a good first cut because it is:

- explicit
- already supported by real website flows
- attributable to landing pages and surfaces
- easy to explain in weekly growth review
- narrow enough for a reviewable PR

Future iterations can broaden activation to include additional signals such as:

- second-day return
- meaningful video/course consumption
- search-driven intent
- command palette/navigation to learning paths
