---
id: introduction-to-cilium-part-ii
slug: introduction-to-cilium-part-ii
title: Introduction to Cilium (Part II)
description: "In this episode, joined by Ilya Dmitrichenko, we'll take a look at Cilium; a CNI implementation for Kubernetes, integrated with eBPF.\n\nCilium is open source software for transparently securing the network connectivity between application services deployed using Linux container management platforms like Docker and Kubernetes.\n\nAt the foundation of Cilium is a new Linux kernel technology called BPF, which enables the dynamic insertion of powerful security visibility and control logic within Linux itself. Because BPF runs inside the Linux kernel, Cilium security policies can be applied and updated without any changes to the application code or container configuration.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n05:20 - What was setup in advance\n06:30 - Installing Cilium / Connectivity Tests\n10:00 - Cilium endpoints\n15:00 - Layer 3/4 network policies\n22:50 - Layer 7 network policies\n31:40 - Hubble UI\n43:10 - DNS network policies\n56:30 - Replacing kube-proxy\n\n\U0001F30E Resources\n\nIlya Dmitrichenko - https://twitter.com/errordeveloper\nCilium - https://cilium.io"
publishedAt: 2020-11-12T17:00:00.000Z
technologies:
  - cilium
show: rawkode-live
videoId: mrdik35fprvp6caj44dpkhnz
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 122
    title: Welcome and Episode Context (Cilium Part II)
  - startTime: 180
    title: Cilium Funding and Enterprise Announcement
  - startTime: 320
    title: What was setup in advance
  - startTime: 328
    title: Cluster Setup and Cilium Deployment
  - startTime: 390
    title: Installing Cilium / Connectivity Tests
  - startTime: 520
    title: Verifying Cilium Installation
  - startTime: 566
    title: Star Wars Demo Application Setup
  - startTime: 600
    title: Cilium endpoints
  - startTime: 682
    title: Cilium Endpoints and Identity
  - startTime: 856
    title: Testing Default Network Access
  - startTime: 900
    title: Layer 3/4 network policies
  - startTime: 913
    title: Applying L4 Network Policy
  - startTime: 997
    title: Testing L4 Policy Enforcement
  - startTime: 1030
    title: L3/L4 vs L7 Policies (Envoy Integration)
  - startTime: 1370
    title: Layer 7 network policies
  - startTime: 1451
    title: Applying L7 Network Policy (HTTP)
  - startTime: 1497
    title: Testing L7 Policy Enforcement
  - startTime: 1526
    title: Examining L7 Implementation (Envoy)
  - startTime: 1800
    title: Cilium CLI and Policy Management
  - startTime: 1827
    title: Introduction to Cilium Monitor (CLI)
  - startTime: 1896
    title: Introduction to Hubble UI
  - startTime: 1900
    title: Hubble UI
  - startTime: 1938
    title: Accessing and Debugging Hubble UI
  - startTime: 2271
    title: Visualizing Network Flows in Hubble UI
  - startTime: 2295
    title: Exploring Hubble UI
  - startTime: 2441
    title: Kube-proxy Replacement with Cilium
  - startTime: 2590
    title: DNS network policies
  - startTime: 2618
    title: Applying FQDN Network Policy (DNS)
  - startTime: 2810
    title: Testing FQDN Policy and Debugging DNS Resolution
  - startTime: 3011
    title: Visualizing DNS Traffic in Hubble UI
  - startTime: 3390
    title: Replacing kube-proxy
  - startTime: 3401
    title: Implementing Kube-proxy Replacement
  - startTime: 3877
    title: Verifying Connectivity (Kube-proxy Removed)
  - startTime: 3922
    title: Checking and Clearing IP Tables
  - startTime: 4222
    title: Conclusion and Wrap-up
duration: 4348
---

