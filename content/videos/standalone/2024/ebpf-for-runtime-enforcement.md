---
id: etr47c1p01p3mefltqwanwhv
slug: ebpf-for-runtime-enforcement
title: eBPF for Runtime Enforcement
description: >-
  Tetragon is a flexible Kubernetes-aware security observability and runtime
  enforcement tool that applies policy and filtering directly with eBPF,
  allowing for reduced observation overhead, tracking of any process, and
  real-time enforcement of policies.
publishedAt: 2024-02-21T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - tetragon
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 30
    title: 'Video Focus: Installing on Linux'
  - startTime: 45
    title: Installation
  - startTime: 46
    title: Installation Options (Linux vs. Kubernetes)
  - startTime: 106
    title: Tetragon
  - startTime: 150
    title: Demonstration
  - startTime: 220
    title: Process Visibility
  - startTime: 234
    title: Tracing Policies Introduction
  - startTime: 248
    title: Adding a Tracing Policy (Kernel Modules Example)
  - startTime: 290
    title: Examining the Policy Definition (YAML)
  - startTime: 331
    title: Tracing Policy Demonstration
  - startTime: 404
    title: Kubernetes
  - startTime: 428
    title: Deploying to Kubernetes (Helm)
  - startTime: 466
    title: Applying Policies in Kubernetes
  - startTime: 490
    title: Conclusion & What's Next
duration: 512
guests: []
resources:
  - title: Tetragon Installation Documentation
    category: documentation
    evidence_quote: >-
      From here, we're going to click on installation. Now we should note there
      are multiple ways to install Tetragon.
    confidence: high
  - title: Tetragon GitHub Releases
    category: code
    evidence_quote: >-
      So from here, we can see that we can grab Tetragon from the GitHub
      releases.
    confidence: high
  - title: Tetragon Helm Chart
    category: code
    evidence_quote: >-
      Now we're going to use Helm, so this isn't anything you haven't seen
      before. We add the repository, do an update, and ask it to install.
    confidence: high
---

