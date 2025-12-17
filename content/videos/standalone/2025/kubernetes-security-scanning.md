---
id: kubernetes-security-scanning
slug: kubernetes-security-scanning
title: "Kubernetes Security Scanning: The 4 Tools You Actually Need"
subtitle: >-
  When it comes to Kubernetes tooling, the landscape is noisy and doesn't always have your back. Finding the right tools can be ... somewhat painful.
description: >-
  When it comes to Kubernetes tooling, the landscape is noisy and doesn't always have your back. Finding the right tools can be ... somewhat painful.


  In this video, we cut through the noise and set up a standardised stack for day two security operations. These tools are the industry standard to secure the platform and the workloads running on top of it.


  The Security Stack Covered:


  - KubeBench (Aqua Security): Checks your cluster against the CIS benchmarks—the global rulebook for hardening Kubernetes.

  - KubeHunter: Acts as a "red team" actively probing your cluster for open ports and backdoors.

  - Sonobuoy: The official CNCF conformance tool to ensure your API behaves correctly and guarantees interoperability.

  - Syft & Grype (Anchore): Generates an SBOM and scans your container images for vulnerabilities (CVEs) like log4j.


  Finally, I'll show you how to automate this entire stack using Spectro Cloud Palette to turn these scans into a simple toggle box operation.


  Links:

  - Spectro Cloud: https://www.spectrocloud.com/
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
videoId: sgs7tm99rldi3ev42yzacukd
duration: 1117
chapters:
  - startTime: 0
    title: "Intro: Keeping your cluster secure Day 2 and beyond"
  - startTime: 46
    title: "The problem with the CNCF Landscape (Too much noise)"
  - startTime: 122
    title: "The Security Stack: Selecting the right tools"
  - startTime: 141
    title: "Tool 1: KubeBench (CIS Benchmarks & Hygiene)"
  - startTime: 214
    title: "Tool 2: KubeHunter (Red Teaming/Offensive)"
  - startTime: 259
    title: "Tool 3: Sonobuoy (Conformance & Interoperability)"
  - startTime: 340
    title: "Tool 4: Syft & Grype (Supply Chain & SBOMs)"
  - startTime: 449
    title: "Demo: Running scans manually with CLI & Manifests"
  - startTime: 616
    title: "Analyzing KubeHunter results"
  - startTime: 680
    title: "Generating an SBOM with Syft"
  - startTime: 808
    title: "Demo: Automating security scans with Palette"
  - startTime: 870
    title: "Reviewing the automated reports (PDF/CSV)"
  - startTime: 985
    title: "API Access & Exporting Audit Data"
---
