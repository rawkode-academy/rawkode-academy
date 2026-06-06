---
id: nbmmmzl4etklri5aruv7hbgq
slug: klustered-part-i
title: Klustered (Part I)
description: >-
  Rawkode and Walid Shaari debug two broken Kubernetes clusters deployed via
  Cluster API on Equinix Metal. They track down a Cilium iptables misconfig,
  swap-enabled kubelets, UFW interference, and a bad etcd endpoint.
publishedAt: 2021-02-18T12:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cluster-api
  - cilium
  - etcd
  - coredns
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 38
    title: Introduction & Guest Welcome
  - startTime: 100
    title: 'Setting the Scene: The Broken Clusters'
  - startTime: 155
    title: Initial Debugging Plan
  - startTime: 225
    title: Starting with Cluster 1 (Lee's Cluster)
  - startTime: 240
    title: Kluster 001 by @briggsl
  - startTime: 280
    title: Initial Health Checks (Cluster 1)
  - startTime: 340
    title: Testing Pod Scheduling
  - startTime: 407
    title: Scheduler Appears to be Working
  - startTime: 429
    title: Investigating Component Status
  - startTime: 520
    title: Port Discrepancy in Component Status
  - startTime: 594
    title: Examining Control Plane Manifests on Node
  - startTime: 1790
    title: Kluster 002 by @thebsdbox
  - startTime: 4315
    title: 'Hypothesis: Missing Port in Manifest'
  - startTime: 4596
    title: Verifying Listening Ports with Netstat
  - startTime: 4650
    title: Identifying the CNI Problem (Cilium)
  - startTime: 4719
    title: Debugging Cilium DaemonSet & Logs
  - startTime: 4851
    title: Fixing Cilium Configuration (iptables rule)
  - startTime: 5056
    title: Verifying Cluster 1 Health & Workload
  - startTime: 5175
    title: Cluster 1 Component Status Red Herring?
  - startTime: 5223
    title: Switching to Cluster 2 (Dan's Cluster)
  - startTime: 5237
    title: 'Initial Check (Cluster 2): API Server Down'
  - startTime: 5436
    title: Attempting Node Access
  - startTime: 5747
    title: Gaining Node Access via Port 2222
  - startTime: 5838
    title: Investigating Kubelet Status
  - startTime: 5974
    title: Identifying the Swap Problem
  - startTime: 6035
    title: Fixing Swap on One Node
  - startTime: 6162
    title: Realizing Swap Problem on All Nodes
  - startTime: 6510
    title: Disabling Swap on All Control Plane Nodes
  - startTime: 6549
    title: API Server Status After Swap Fix
  - startTime: 6603
    title: Firewall Interference (UFW)
  - startTime: 6632
    title: API Server Disappears Again
  - startTime: 6702
    title: Investigating API Server Logs & etcd Connection
  - startTime: 7051
    title: Fixing API Server etcd Endpoint Configuration
  - startTime: 7208
    title: API Server & Cluster 2 Restored
  - startTime: 7292
    title: Addressing CoreDNS and CIDR Problem
  - startTime: 7421
    title: Fixing Cluster CIDR in Kubeadm Config
  - startTime: 7513
    title: Final Verification (Cluster 2)
  - startTime: 7565
    title: 'Discussion, Realism of Problems, and Conclusion'
duration: 5715
guests:
  - walidshaari
resources: []
---

