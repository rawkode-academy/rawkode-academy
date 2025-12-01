---
id: restrict-access-to-secure-files-with-tetragon
slug: restrict-access-to-secure-files-with-tetragon
title: Restrict Access to Secure Files with Tetragon
description: >-
  eBPF-based Security Observability and Runtime Enforcement


  Tetragon is a flexible Kubernetes-aware security observability and runtime
  enforcement tool that applies policy and filtering directly with eBPF,
  allowing for reduced observation overhead, tracking of any process, and
  real-time enforcement of policies.


  Cilium Tetragon component enables powerful realtime, eBPF-based Security
  Observability and Runtime Enforcement.


  Tetragon detects and is able to react to security-significant events, such as


  - Process execution events

  - System call activity

  - I/O activity including network & file access


  When used in a Kubernetes environment, Tetragon is Kubernetes-aware - that is,
  it understands Kubernetes identities such as namespaces, pods and so-on - so
  that security event detection can be configured in relation to individual
  workloads.


  Tetragon is a runtime security enforcement and observability tool. What this
  means is Tetragon applies policy and filtering directly in eBPF in the kernel.
  It performs the filtering, blocking, and reacting to events directly in the
  kernel instead of sending events to a user space agent.


  For an observability use case, applying filters directly in the kernel
  drastically reduces observation overhead. By avoiding expensive context
  switching and wake-ups, especially for high frequency events, such as send,
  read, or write operations, eBPF reduces required resources. Instead, Tetragon
  provides rich filters (file, socket, binary names, namespace/capabilities,
  etc.) in eBPF, which allows users to specify the important and relevant events
  in their specific context, and pass only those to the user-space agent.


  Tetragon can hook into any function in the Linux kernel and filter on its
  arguments, return value, associated metadata that Tetragon collects about
  processes (e.g., executable names), files, and other properties. By writing
  tracing policies users can solve various security and observability use cases.
  We provide a number of examples for these in the repository and highlight some
  below in the ‘Getting Started Guide’, but users are encouraged to create new
  policies that match their use cases. The examples are just that, jumping off
  points that users can then use to create new and specific policy deployments
  even potentially tracing kernel functions we did not consider. None of the
  specifics about which functions are traced and what filters are applied are
  hard-coded in the engine itself.


  Critically, Tetragon allows hooking deep in the kernel where data structures
  can not be manipulated by user space applications avoiding common issues with
  syscall tracing where data is incorrectly read, maliciously altered by
  attackers, or missing due to page faults and other user/kernel boundary
  errors.


  Many of the Tetragon developers are also kernel developers. By leveraging this
  knowledge base Tetragon has created a set of tracing policies that can solve
  many common observability and security use cases.


  Tetragon, through eBPF, has access to the Linux kernel state. Tetragon can
  then join this kernel state with Kubernetes awareness or user policy to create
  rules enforced by the kernel in real time. This allows annotating and
  enforcing process namespace and capabilities, sockets to processes, process
  file descriptor to filenames and so on. For example, when an application
  changes its privileges we can create a policy to trigger an alert or even kill
  the process before it has a chance to complete the syscall and potentially run
  additional syscalls.
publishedAt: 2024-02-22T17:00:00.000Z
technologies:
  - tetragon
videoId: tfahqa0n2pld6jvnu7a8k5w9
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
---

