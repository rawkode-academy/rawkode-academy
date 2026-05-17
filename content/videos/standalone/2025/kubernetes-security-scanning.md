---
id: sgs7tm99rldi3ev42yzacukd
slug: kubernetes-security-scanning
title: 'Kubernetes Security Scanning: The 4 Tools You Actually Need'
subtitle: >-
  When it comes to Kubernetes tooling, the landscape is noisy and doesn't always
  have your back. Finding the right tools can be ... somewhat painful.
description: >-
  When it comes to Kubernetes tooling, the landscape is noisy and doesn't always
  have your back. Finding the right tools can be ... somewhat painful.
publishedAt: 2025-12-12T00:00:00.000Z
type: recorded
category: tutorial
technologies:
  - kubernetes
  - kube-bench
  - kube-hunter
  - sonobuoy
  - syft
  - grype
duration: 1117
guests: []
chapters:
  - startTime: 0
    title: 'Intro: Keeping your cluster secure Day 2 and beyond'
  - startTime: 46
    title: The problem with the CNCF Landscape (Too much noise)
  - startTime: 122
    title: 'The Security Stack: Selecting the right tools'
  - startTime: 141
    title: 'Tool 1: KubeBench (CIS Benchmarks & Hygiene)'
  - startTime: 214
    title: 'Tool 2: KubeHunter (Red Teaming/Offensive)'
  - startTime: 259
    title: 'Tool 3: Sonobuoy (Conformance & Interoperability)'
  - startTime: 340
    title: 'Tool 4: Syft & Grype (Supply Chain & SBOMs)'
  - startTime: 449
    title: 'Demo: Running scans manually with CLI & Manifests'
  - startTime: 616
    title: Analyzing KubeHunter results
  - startTime: 680
    title: Generating an SBOM with Syft
  - startTime: 808
    title: 'Demo: Automating security scans with Palette'
  - startTime: 870
    title: Reviewing the automated reports (PDF/CSV)
  - startTime: 985
    title: API Access & Exporting Audit Data
resources:
  - title: Spectro Cloud Palette
    category: other
    evidence_quote: >-
      At the end of this video, you will see a demo with Spectral Cloud, where I
      turn on all of my day two secondurity scanning operations with a toggle
      box.
    confidence: high
  - title: Google Microservices Demo
    category: demos
    evidence_quote: >-
      This is just using a Docker desktop with the Google microservices demo
      deployed.
    confidence: high
  - title: CIS Kubernetes Benchmarks
    category: documentation
    evidence_quote: >-
      It checks the cluster against the SIS benchmarks, which is basically the
      global rule book if one were to exist for hardening Kubernetes.
    confidence: high
---

