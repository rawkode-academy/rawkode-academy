---
id: e0osaaguckezvjzf42dm6zbc
slug: klustered-part-viii-ii
title: Klustered (Part VIII-II)
description: >-
  Noel Georgi returns to debug Kluster 015, where a corrupted Cilium CNI binary
  and a malicious systemd-collector-d binary hijacking the containerd shim leave
  pods stuck. crictl, shim comparisons, and Rawkode service fixes restore it.
whatYouWillLearn:
  - "Trace API server restart behavior and stuck Pods by reading cluster logs and runtime diagnostics step by step."
  - "Reproduce Cilium networking failures, compare plugin and shim binaries across nodes, and verify containerd sandbox behavior with crictl."
  - "Detect and remove a malicious systemd-collector-d binary, then fix remaining Rawkode service settings to restore API server access."
publishedAt: 2021-04-09T13:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - containerd
show: klustered
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 20
    title: Introductions
  - startTime: 22
    title: Introduction and Previous Recap
  - startTime: 84
    title: API Server Fix (Resource Limits) Recap
  - startTime: 90
    title: Kluster 015
  - startTime: 208
    title: Initial Pod State (Completed/Init) Investigation
  - startTime: 432
    title: Investigating Cilium (CNI) Pods
  - startTime: 601
    title: Debugging Init Containers and Sandbox Errors
  - startTime: 746
    title: Using crictl to Inspect Containerd
  - startTime: 1012
    title: Corrupted Cilium CNI Binary Found
  - startTime: 1311
    title: Replacing the CNI Binary on Control Plane
  - startTime: 1620
    title: Persistent Sandbox Issues & Containerd Debugging
  - startTime: 2720
    title: Comparing Containerd Across Nodes (Shim/Cgroup Differences)
  - startTime: 3147
    title: Identifying Malicious `systemd-collector-d` Binary
  - startTime: 4218
    title: Removing Malicious Binaries & Restarting Services
  - startTime: 4295
    title: Verifying Containerd Fix & CNI Status
  - startTime: 4722
    title: 'New Issue: API Server Communication Problems'
  - startTime: 5036
    title: Checking ETCD & API Server Logs
  - startTime: 5296
    title: Debugging Rawkode Application Pods
  - startTime: 5556
    title: Fixing Rawkode Service Configuration
  - startTime: 5676
    title: Cluster Fixed & Conclusion
duration: 5756
guests:
  - frezbo
resources:
  - title: Cilium Quick Start documentation
    type: url
    url: 'https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/'
    category: documentation
  - title: Equinix Metal
    type: url
    url: 'https://deploy.equinix.com/'
    category: other
---
