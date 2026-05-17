---
id: gkvfatiptx9zm9zmvcyipvt7
slug: klustered-10
title: 'Klustered #10'
description: >-
  Walid Shaari and Noel Georgi join Rawkode to debug three broken Kubernetes
  clusters, tackling kubelet failures, RBAC misconfigurations, a missing
  scheduler role, an AlwaysDeny admission controller, mutating webhooks,
  containerd registry rewrites, and CoreDNS Corefile sabotage.
publishedAt: 2021-05-06T13:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - containerd
  - coredns
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 55
    title: Introductions
  - startTime: 74
    title: 'Housekeeping (Subscribe, Discord, Sponsors)'
  - startTime: 134
    title: Introducing Walid and Noel
  - startTime: 214
    title: Debugging Walid's Cluster (Cluster 19 Begins)
  - startTime: 220
    title: Cluster by Walid Shaari
  - startTime: 330
    title: Initial Cluster State & RBAC Issue (Describe nodes fails)
  - startTime: 423
    title: Fixing the Worker Kubelet (Restarting dead kubelet)
  - startTime: 1780
    title: Cluster by Noel Georgi
  - startTime: 3652
    title: Investigating Pod Pending State (Cilium/Postgres)
  - startTime: 3720
    title: Cluster by Rawkode
  - startTime: 3930
    title: 'Identifying Cluster-Level RBAC Issue (Can get, cannot describe)'
  - startTime: 4266
    title: Debugging RBAC Configuration and Roles
  - startTime: 4642
    title: Finding & Using the Admin Kubeconfig (.honk hint)
  - startTime: 4796
    title: Debugging the Kube Scheduler (Pods pending due to scheduler)
  - startTime: 5058
    title: Identifying Missing Scheduler Role
  - startTime: 5122
    title: Fixing Core RBAC via API Server Restart
  - startTime: 5366
    title: Walid's Cluster Fixed
  - startTime: 5383
    title: Debugging Noel's Cluster (Cluster 20 Begins)
  - startTime: 5469
    title: kubectl Binary Hijacked (honkctl alias found)
  - startTime: 5524
    title: >-
      Identifying the AlwaysDeny Admission Controller (Discussing finding the
      second plugin)
  - startTime: 5542
    title: Fixing the AlwaysDeny Admission Controller
  - startTime: 5605
    title: Post-Fix Discussion & Learnings
  - startTime: 5610
    title: Initial Pod State & Rollout Failure (Forbidden)
  - startTime: 5698
    title: Conclusion and Next Episodes
  - startTime: 5868
    title: Investigating Mutating Webhooks (Finding honk webhook)
  - startTime: 6239
    title: ImagePullBackOff Error (Incorrect image version)
  - startTime: 6417
    title: Debugging Port Forward Failure (Investigating Iptables)
  - startTime: 6747
    title: Mutating Webhook Causing Image Revert (Revisiting the webhook config)
  - startTime: 6858
    title: Containerd Registry Rewrite Issue (Image pull fails)
  - startTime: 7056
    title: Fixing Containerd Registry Configuration (Deleting hosts.toml)
  - startTime: 7200
    title: Debugging Coredns (Corefile Rewrite)
  - startTime: 7285
    title: Fixing Coredns Configuration
  - startTime: 7352
    title: Moving to David's Cluster (Cluster 21 Begins)
  - startTime: 7454
    title: Initial Cluster State & Slowness (API server timing out)
  - startTime: 7800
    title: Investigating API Server Errors & Missing Logs
  - startTime: 8161
    title: Fixing Log Directory Permissions
  - startTime: 8480
    title: Identifying the Source of Slowness (Throttling Proxy)
  - startTime: 8627
    title: Fixing the Throttling Proxy (Renamed SE Linux process)
  - startTime: 8666
    title: Pod Still Creating & Admission Denied (LimitRange forbidden)
duration: 5770
guests:
  - walid-shaari
  - noel-georgi
resources:
  - title: Rawkode Discord
    type: url
    url: 'https://rawkode.chat'
    category: other
  - title: Equinix Metal
    type: url
    url: 'https://deploy.equinix.com/'
    category: other
---

