---
id: xn5lyqrxw1a9e6c39zsi17s2
slug: klustered-17
title: 'Klustered #17'
description: >-
  Adam Szücs-Mátyás and William Lightning debug two broken Kubernetes clusters.
  Fixes cover cordoned nodes, a CoreDNS ConfigMap, a Harbor image redirect via
  containerd, plus etcd permission and disk-full recovery from a loopback mount.
publishedAt: 2021-08-20T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - coredns
  - etcd
  - postgresql
  - teleport
  - containerd
  - harbor
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 102
    title: Introductions
  - startTime: 103
    title: 'Intro, Housekeeping & Sponsor'
  - startTime: 181
    title: Guest Introductions
  - startTime: 252
    title: Is it Scary or Fun to Break Clusters?
  - startTime: 402
    title: Debugging Adam's Cluster (Part 1)
  - startTime: 405
    title: Cluster by Ádám Szücs-Mátyás
  - startTime: 450
    title: 'Initial Checks: Nodes Unschedulable'
  - startTime: 510
    title: Application is Down
  - startTime: 535
    title: Incorrect Application Image
  - startTime: 702
    title: Fixing Unschedulable Nodes
  - startTime: 957
    title: Database Connectivity Issue
  - startTime: 968
    title: Debugging Postgres
  - startTime: 1250
    title: Checking Network Policies
  - startTime: 1390
    title: Network Debugging Tools & Failed Ping
  - startTime: 1866
    title: DNS Resolution Failure
  - startTime: 2004
    title: Fixing CoreDNS Config
  - startTime: 2057
    title: Restarting CoreDNS & App Works
  - startTime: 2171
    title: Upgrading Application to v2
  - startTime: 2237
    title: Adam Reveals His Breaks
  - startTime: 2344
    title: Debugging William's Cluster (Part 2)
  - startTime: 2355
    title: Cluster by William Lightning
  - startTime: 2470
    title: Control Plane is Down
  - startTime: 2510
    title: Investigating Static Manifests
  - startTime: 2635
    title: Flushing IP Tables
  - startTime: 2761
    title: 'API Server Error: Cannot Reach etcd'
  - startTime: 2818
    title: etcd Permissions Issue
  - startTime: 2889
    title: etcd Disk Full Issue
  - startTime: 3007
    title: Fixing etcd File Permissions
  - startTime: 3258
    title: Disk Space & Loopback Mount Issue
  - startTime: 3476
    title: Searching for etcd Backup
  - startTime: 3590
    title: Restoring etcd Data & Control Plane Fixed
  - startTime: 3761
    title: Nodes Not Ready (CNI)
  - startTime: 3833
    title: Scheduler Crashing (Volume Mount Issue)
  - startTime: 4134
    title: Manually Scheduling Pods & App Works
  - startTime: 4490
    title: William & Adam Reveal Breaks
  - startTime: 4630
    title: Conclusion
duration: 4709
guests:
  - adam-szucs-matyas
  - william-lightning
resources:
  - title: Teleport
    type: url
    url: 'https://goteleport.com/'
    category: other
---

