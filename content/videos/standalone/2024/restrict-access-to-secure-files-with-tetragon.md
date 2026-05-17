---
id: tfahqa0n2pld6jvnu7a8k5w9
slug: restrict-access-to-secure-files-with-tetragon
title: Restrict Access to Secure Files with Tetragon
description: >-
  Tetragon is a flexible Kubernetes-aware security observability and runtime
  enforcement tool that applies policy and filtering directly with eBPF,
  allowing for reduced observation overhead, tracking of any process, and
  real-time enforcement of policies.
publishedAt: 2024-02-22T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - tetragon
chapters:
  - startTime: 0
    title: Introduction to File Access Enforcement with Tetragon
  - startTime: 41
    title: Exploring Tetragon Concepts and Documentation
  - startTime: 71
    title: >-
      Understanding Tracing Policies and Hook Points (kprobe, uprobe,
      tracepoint)
  - startTime: 139
    title: Writing a Basic Tracing Policy using Kprobe (sys_write)
  - startTime: 160
    title: Using kubectl explain for Tracing Policy Structure
  - startTime: 248
    title: Finding Syscall Function Signatures
  - startTime: 325
    title: Mapping Syscall Arguments in the Policy
  - startTime: 403
    title: Applying the Basic Tracing Policy
  - startTime: 432
    title: Checking Tetragon Logs for Events
  - startTime: 475
    title: Setting Up Log Tail and Test Pod
  - startTime: 552
    title: Triggering a Syscall Event (Writing to a file)
  - startTime: 578
    title: Analyzing Basic Sys_write Log Output
  - startTime: 622
    title: Detailed Examination of a Log Entry (JSON)
  - startTime: 749
    title: Filtering Events with Selectors
  - startTime: 793
    title: Using matchArgs for Path Filtering
  - startTime: 842
    title: Finding Kernel Function Signatures (Sourcegraph)
  - startTime: 885
    title: Explaining matchArgs with /etc/password Example Policy
  - startTime: 896
    title: Testing Path Filtering with /etc/password
  - startTime: 952
    title: Modifying Policy for Prefix Matching (/etc/)
  - startTime: 971
    title: Testing Prefix Matching with /etc/lsb-release
  - startTime: 1010
    title: Implementing Runtime Enforcement Actions (Sigkill)
  - startTime: 1029
    title: Adding Sigkill Action to the Policy
  - startTime: 1089
    title: Testing Sigkill Enforcement (Process Killed)
  - startTime: 1100
    title: Implementing getURL Action
  - startTime: 1121
    title: Setting Up Request Bin for getURL Test
  - startTime: 1131
    title: Applying Policy with getURL Action
  - startTime: 1149
    title: 'Testing getURL Action (Access Allowed, URL Triggered)'
  - startTime: 1161
    title: Verifying getURL Trigger in Request Bin
  - startTime: 1173
    title: Potential Use Cases for getURL Action
  - startTime: 1200
    title: 'Conclusion, Security Layers, and Next Steps (Process Life Cycles)'
duration: 1256
guests: []
resources:
  - title: Tetragon Tracing Policy Concepts
    type: url
    category: documentation
  - title: Tetragon GitHub Examples
    type: url
    url: 'https://github.com/cilium/tetragon'
    category: code
  - title: di.net Linux Man Pages
    type: url
    url: 'https://di.net'
    category: documentation
  - title: Sourcegraph Linux Kernel Search
    type: url
    category: other
---

