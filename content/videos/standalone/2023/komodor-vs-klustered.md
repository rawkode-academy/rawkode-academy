---
id: dcjov47ebu5lv9zvbe787zpj
slug: komodor-vs-klustered
title: Komodor Vs. Klustered
description: >-
  Komodor's CTO and engineers debug a maliciously broken Kubernetes cluster
  live, using their timeline to track down Cilium CNI RBAC, Flux GitOps
  reconciliation, and a NetworkPolicy blocking Drupal from Postgres.
whatYouWillLearn:
  - "Trace service changes over time to spot broken deploys and config drift."
  - "Use manifest diffs and RBAC checks to explain Cilium agent failures."
  - "Follow DNS and NetworkPolicy evidence to restore Drupal to Postgres access."
publishedAt: 2023-12-13T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - cilium
  - fluxcd
  - helm
  - komodor
  - kubernetes
chapters:
  - startTime: 0
    title: Introduction and Challenge Setup
  - startTime: 81
    title: Initial Service Investigation in Komodor
  - startTime: 96
    title: 'Identifying Problem 1: Deployment/PVC Config Change'
  - startTime: 173
    title: 'Identifying Problem 2: Scheduling & Node Issue'
  - startTime: 346
    title: 'Investigating Problem 3: CNI Network Unavailability'
  - startTime: 537
    title: Debugging Cilium Deployment/Helm Release
  - startTime: 719
    title: Uncovering Cilium RBAC Issues via Manifest Diff
  - startTime: 776
    title: Granting Komodor Agent Permissions (via terminal)
  - startTime: 840
    title: Node Fixed (Cilium RBAC & Cordon)
  - startTime: 882
    title: 'Back to Drupal Service: GitOps Deployment Issue'
  - startTime: 1003
    title: GitOps Pipeline Status Investigation
  - startTime: 1248
    title: Investigating GitOps Reconciliation Failure
  - startTime: 1400
    title: Manually Fixing Cilium Pod
  - startTime: 1458
    title: Cilium & GitOps Pipeline Restored
  - startTime: 1533
    title: Testing Drupal Website (Encountering Problem 4)
  - startTime: 1612
    title: 'Identifying Problem 4: Database Connection (DNS) Failure'
  - startTime: 1630
    title: Debugging Network Connectivity / Network Policy
  - startTime: 1713
    title: Fixing Network Policy (Deleting Policy)
  - startTime: 1755
    title: Drupal Website Restored
  - startTime: 1769
    title: Recap and Final Thoughts
duration: 1815
guests: []
resources: []
---
