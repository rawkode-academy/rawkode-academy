---
id: ebpf-for-runtime-enforcement
slug: ebpf-for-runtime-enforcement
title: eBPF for Runtime Enforcement
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
publishedAt: 2024-02-21T17:00:00.000Z
technologies:
  - tetragon
videoId: etr47c1p01p3mefltqwanwhv
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
---

