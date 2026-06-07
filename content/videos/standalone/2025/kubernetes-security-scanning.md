---
id: sgs7tm99rldi3ev42yzacukd
slug: kubernetes-security-scanning
title: 'Kubernetes Security Scanning: The 4 Tools You Actually Need'
subtitle: >-
  When it comes to Kubernetes tooling, the landscape is noisy and doesn't always
  have your back. Finding the right tools can be ... somewhat painful.
description: >-
  Four tools for Kubernetes day-two security: kube-bench for CIS hygiene,
  kube-hunter for red-team probing, Sonobuoy for CNCF conformance, and Syft plus
  Grype for SBOMs and CVEs. Demo runs them by hand, then automates via Spectro
  Cloud Palette.
whatYouWillLearn:
  - "Explain how kube-bench checks clusters against CIS benchmarks for hardening hygiene."
  - "Show how kube-hunter probes exposed ports, dashboards, and logic flaws from inside."
  - "Build an SBOM with Syft, then use Grype to find CVEs."
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
    type: url
    url: 'https://www.spectrocloud.com/product/palette'
    category: other
  - title: Google Microservices Demo
    type: url
    url: 'https://github.com/GoogleCloudPlatform/microservices-demo'
    category: demos
  - title: CIS Kubernetes Benchmarks
    type: url
    url: 'https://www.cisecurity.org/benchmark/kubernetes'
    category: documentation
  - title: kube-bench
    type: url
    url: 'https://github.com/aquasecurity/kube-bench'
    category: code
  - title: kube-hunter
    type: url
    url: 'https://github.com/aquasecurity/kube-hunter'
    category: code
  - title: Sonobuoy
    type: url
    url: 'https://sonobuoy.io/'
    category: documentation
  - title: Syft
    type: url
    url: 'https://github.com/anchore/syft'
    category: code
  - title: Grype
    type: url
    url: 'https://github.com/anchore/grype'
    category: code
---
