---
id: etr47c1p01p3mefltqwanwhv
slug: ebpf-for-runtime-enforcement
title: eBPF for Runtime Enforcement
description: >-
  Install Tetragon on a Linux host via the GitHub release and as a systemd
  service, then deploy it to Kubernetes with Helm. Add a TracingPolicy that
  hooks kernel probes to monitor module loading, and inspect events with the
  tetra CLI.
whatYouWillLearn:
  - "Install Tetragon on Linux from GitHub releases and run it as a systemd service"
  - "Inspect live process events with tetra get events and relate output to running commands"
  - "Add a tracing policy for kernel module activity and apply it in Kubernetes with Helm"
publishedAt: 2024-02-21T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - tetragon
  - kubernetes
  - helm
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
    type: url
    url: 'https://tetragon.io/docs/installation/'
    category: documentation
  - title: Tetragon GitHub Releases
    type: url
    url: 'https://github.com/cilium/tetragon/releases'
    category: code
  - title: Tetragon Helm Chart
    type: url
    url: 'https://github.com/cilium/tetragon/tree/main/install/kubernetes/tetragon'
    category: code
---
