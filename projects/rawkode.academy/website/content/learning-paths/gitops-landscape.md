---
title: "GitOps Landscape"
description: "Build a GitOps-first operating model. This path layers modern packaging, reconciliation, and developer experience tooling—Timoni, Kluctl, FluxCD, Gimlet, and Sveltos—so you can run fleets with confidence."
difficulty: "advanced"
estimatedDuration: 432
prerequisites:
  - "Comfortable with Kubernetes fundamentals (control plane, nodes, pods, services, deployments)."
  - "Daily `kubectl` user familiar with contexts, namespaces, and auth."
  - "Experience managing manifests with Helm/Kustomize or similar tooling."
  - "Working knowledge of Git workflows (branches, PRs) and CI/CD automation."
  - "Optional: exposure to CUE, GitOps controllers (Flux/Argo), or multi-cluster operations." 
technologies:
  - "Kubernetes"
  - "Timoni"
  - "CUE"
  - "Kluctl"
  - "FluxCD"
  - "GitOps Toolkit"
  - "Gimlet"
  - "Sveltos"
  - "GitOps"
publishedAt: "2025-10-01"
authors:
  - "rawkode"
---

# GitOps Landscape

GitOps is more than a controller—you need packaging discipline, environment orchestration, reconciliation pipelines, and developer UX. This path assembles opinionated tools so platform engineers can scale fleets while keeping guardrails intact.

## Learning Objectives

- Author type-safe application packages with CUE/Timoni and publish them as OCI artifacts.
- Orchestrate multi-environment rollouts with Kluctl’s structural diffs and templating.
- Bootstrap FluxCD 2, model sources/Kustomizations/HelmReleases, and control reconcilers with dependencies.
- Provide a developer-facing GitOps workflow via Gimlet while preserving Git-based audit trails.
- Manage add-ons across clusters using Sveltos’ intent-based policies and dynamic classifiers.

## Videos in This Path

### 1. [Timoni: CUE-powered Package Management](/watch/timoni-cue-powered-package-management-for-kubernetes)

**Why it matters:** Configuration drift often starts with templating errors. Timoni couples CUE validation with OCI distribution so application definitions stay trustworthy.

**What you'll learn:**
- Model services in CUE, enforce schemas, and catch mistakes before they hit the cluster.
- Package modules/bundles and push them to OCI registries alongside container images.
- Upgrade safely with server-side apply and observe minimal diffs.

**Key takeaways:**
- Timoni replaces ad-hoc Helm templating with type-safe unification, reducing runtime surprises.
- OCI-backed bundles make promotion pipelines reproducible and auditable.

**Hands-on drill:** Convert an existing workload into a Timoni module + bundle, publish it to an OCI registry, and deploy it to staging.

### 2. [Hands-on Introduction to Kluctl](/watch/hands-on-introduction-to-kluctl)

**Why it matters:** Once packages are solid, you need promotion discipline. Kluctl adds environment targets, previews, and pruning on top of GitOps.

**What you'll learn:**
- Structure a Kluctl project with dev/stage/prod targets using Jinja2 and variable files.
- Preview pending changes via `kluctl diff` before committing to Git.
- Sequence resource deployments and clean out abandoned objects with `kluctl prune`.

**Key takeaways:**
- Kluctl glues templating, diffs, and GitOps together so environments stay predictable.
- Change previews provide guardrails missing from plain `kubectl apply` or raw Git controllers.

**Hands-on drill:** Build a three-target Kluctl repo, run diff/deploy for each environment, and document a rollback flow.

### 3. [GitOps Tutorial with FluxCD 2 (GitOps Toolkit)](/watch/gitops-tutorial-with-fluxcd-2-gitops-toolkit)

**Why it matters:** FluxCD is the reconciliation engine for your GitOps platform. Master its controllers, dependencies, and health checks.

**What you'll learn:**
- Bootstrap FluxCD with `gotk bootstrap` and connect it to a Git repo.
- Define `GitRepository`, `HelmRepository`, `Kustomization`, and `HelmRelease` resources.
- Chain dependencies, enforce health checks, and suspend/resume reconciliation during incidents.

**Key takeaways:**
- FluxCD 2 decomposes GitOps into modular controllers—sources, kustomizations, Helm—so pipelines stay composable.
- Dependency graphs and health gates ensure infrastructure comes up in the right order.

**Hands-on drill:** Bootstrap Flux into a test cluster, deploy an app with a HelmRelease, and add a dependency/health gate on a prerequisite component.

### 4. [Hands-on Introduction to GitOps with Gimlet](/watch/hands-on-introduction-to-gitops-with-gimlet)

**Why it matters:** Developers need a polished workflow, not CRDs. Gimlet layers a UI and marketplace on top of Flux so teams ship without touching YAML.

**What you'll learn:**
- Install Gimlet, connect it to a cluster, and trigger a buildpack-powered deploy.
- Watch how Gimlet writes Git commits/PRs that Flux reconciles.
- Manage configuration changes (replicas, env vars) and install add-ons from the marketplace.

**Key takeaways:**
- Gimlet offers a stair-step journey into GitOps—UI onboarding backed by Git commits you can review.
- Focused developer workflows keep platform teams in control while devs stay productive.

**Hands-on drill:** Deploy an app via Gimlet, approve the resulting Git PR, and exercise a rollback using Git history.

### 5. [Hands-on Tutorial of Project Sveltos](/watch/hands-on-tutorial-of-project-sveltos)

**Why it matters:** GitOps doesn’t stop at workloads. Sveltos pushes add-ons and policies across fleets based on intent and cluster metadata.

**What you'll learn:**
- Target clusters with `ClusterProfile` resources driven by labels, versions, or runtime state.
- Automatically install add-ons as clusters register or change properties.
- Integrate Sveltos with Flux so add-on definitions live in Git and reconcile continuously.

**Key takeaways:**
- Sveltos eliminates per-cluster babysitting—classifiers apply the right configs as fleets evolve.
- GitOps integration keeps add-on state auditable and aligned with compliance requirements.

**Hands-on drill:** Label two clusters, create a ClusterProfile that deploys an ingress controller, and verify Sveltos heals manual drift.

## Bonus Practice

- [Kluctl Controller Deep Dive](/watch/kluctl-new-features-and-updates) — manage GitOps natively via CRDs.
- [Feature Flags via GitOps with Flipt](/watch/feature-flags-via-gitops-with-flipt) — extend GitOps workflows beyond infrastructure.

## Fleet Follow-ups

1. Wire Timoni and Kluctl bundles into Flux via OCI sources + Kustomizations for full GitOps automation.
2. Onboard a pilot team to Gimlet, gather feedback, and codify approvals/rollbacks in Git workflows.
3. Combine Flux alerts + Sveltos reconciliation metrics to build fleet-level operational dashboards and policies.
