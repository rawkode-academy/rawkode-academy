---
id: d52og3gdtmtu7w8nhkyg1uyt
slug: kubescape-cli-and-github-action
title: Kubescape CLI & GitHub Action
description: >-
  Use the Kubescape CLI to scan plain manifests, Kustomize overlays, and Helm
  charts against frameworks like NSA/CISA, then wire the GitHub Action into CI
  to publish pretty-printer, JUnit, and SARIF reports to Code Scanning.
publishedAt: 2022-12-20T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - kubescape
  - kubernetes
  - helm
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 33
    title: 'Kubescape CLI Basics: Scanning Directories'
  - startTime: 86
    title: Analyzing Initial Scan Results
  - startTime: 170
    title: Scanning Specific Frameworks
  - startTime: 203
    title: Controlling Exit Code with Severity Threshold
  - startTime: 271
    title: Scanning for Individual Controls
  - startTime: 289
    title: Listing Controls
  - startTime: 330
    title: Inspecting Specific Resource Violations
  - startTime: 349
    title: Handling Exceptions (SaaS Mention)
  - startTime: 371
    title: Scanning Kustomize Manifests
  - startTime: 505
    title: Scanning Helm Charts
  - startTime: 600
    title: Introduction to CI/CD Integration
  - startTime: 693
    title: Setting up the GitHub Action Workflow
  - startTime: 847
    title: Viewing Action Output (Pretty Printer Format)
  - startTime: 963
    title: Publishing JUnit Reports
  - startTime: 1063
    title: Publishing SARIF Reports for Code Scanning
  - startTime: 1195
    title: Exploring GitHub Code Scanning Alerts
  - startTime: 1245
    title: Remediation and Workflow Integration
  - startTime: 1270
    title: Conclusion
duration: 1304
guests: []
resources:
  - title: Kubescape GitHub Action
    type: url
    url: 'https://github.com/kubescape/github-action'
    category: code
  - title: Google Microservices Demo
    type: url
    url: 'https://github.com/GoogleCloudPlatform/microservices-demo'
    category: demos
  - title: Weaveworks Sock Shop
    type: url
    url: 'https://github.com/microservices-demo/microservices-demo'
    category: demos
  - title: NSA/CISA Kubernetes Hardening Guidance
    type: url
    url: >-
      https://media.defense.gov/2022/Aug/29/2003066362/-1/-1/0/CTR_KUBERNETES_HARDENING_GUIDANCE_1.2_20220829.PDF
    category: documentation
  - title: Klustered Automation Repository
    type: url
    url: 'https://github.com/rawkode-academy/klustered'
    category: code
---

