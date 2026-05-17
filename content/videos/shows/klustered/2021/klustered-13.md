---
id: kmhmcc41uglftsqr66vbo0di
slug: klustered-13
title: 'Klustered #13'
description: >-
  Mahmoud Saada and Marques Johansson debug two broken Kubernetes clusters,
  tackling a LimitRange blocking scaling, a bad image pull secret, resource
  quota and taint issues, plus a Cilium outage caused by a containerd registry
  mirror rewriting images to honky.io.
publishedAt: 2021-06-03T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - containerd
  - teleport
  - postgresql
show: klustered
chapters:
  - startTime: 0
    title: Viewer Comments
  - startTime: 98
    title: Introduction to Klustered
  - startTime: 107
    title: Housekeeping & Announcements
  - startTime: 148
    title: Guest Introductions (Mahmoud & Marcus)
  - startTime: 238
    title: Starting Cluster 1 Debugging (Marcus's Cluster)
  - startTime: 290
    title: Initial Cluster Checks & Scaling Deployment
  - startTime: 344
    title: Scaling Deployment & Observing Failure
  - startTime: 502
    title: Investigating Control Plane / Controller Manager
  - startTime: 676
    title: 'Analyzing Controller Manager Logs: Resource Limits'
  - startTime: 733
    title: Identifying & Deleting LimitRange
  - startTime: 860
    title: Teleport Disconnect / Session Issue 1
  - startTime: 915
    title: Teleport Recovers / Coincidence?
  - startTime: 966
    title: Debugging Image Pull BackOff (Bad Secret)
  - startTime: 1306
    title: Fixing Image Pull Secret & Pod Runs
  - startTime: 1390
    title: Finding Missing Database (StatefulSet)
  - startTime: 1438
    title: Scaling StatefulSet & New Scheduling/Quota Errors
  - startTime: 1558
    title: Debugging Resource Quota & Persistent Errors
  - startTime: 1641
    title: Debugging Node Scheduling (Taints & Selectors)
  - startTime: 1953
    title: Teleport Disconnect / Session Issue 2 & Removing Node Selector
  - startTime: 2159
    title: StatefulSet Pod Runs & Cluster 1 Appears Fixed
  - startTime: 2232
    title: Testing Application Access & Confirming App Version (Cluster 1 Fixed)
  - startTime: 2610
    title: Transition to Cluster 2 Debugging (Moody's Cluster)
  - startTime: 3905
    title: Fixing Controller Manager Image
  - startTime: 4087
    title: 'Restarting System Pods (Cilium, etc.)'
  - startTime: 4348
    title: Applying App Update (v2)
  - startTime: 4457
    title: Debugging Slow Image Pull & Final Fix
  - startTime: 4644
    title: Recap of Breaks & Conclusion
  - startTime: 16871
    title: Hint for Cluster 2
  - startTime: 17059
    title: 'Starting Cluster 2 Debugging: Widespread Failures'
  - startTime: 17773
    title: 'Debugging Cilium: Honky.io Image'
  - startTime: 18315
    title: Identifying Containerd Image Mirror Issue
  - startTime: 19413
    title: Modifying Containerd Config & Restarting on all Nodes
  - startTime: 20411
    title: 'Containerd Fixed: Cilium Pods Initializing'
  - startTime: 21483
    title: Investigating Persistent Honk Image Issue (Static Pod Manifest)
duration: 4953
guests:
  - marques-johansson
  - mahmoud-saada
resources:
  - title: Rawkode.chat Discord channel
    type: url
    url: 'https://rawkode.chat'
    category: other
  - title: Kubernetes controller utils create pods code
    type: url
    url: 'https://github.com/kubernetes/kubernetes/blob/master/pkg/controller/controller_utils.go'
    category: code
  - title: Cilium documentation
    type: url
    url: 'https://docs.cilium.io/en/stable/'
    category: documentation
  - title: containerd registry configuration
    type: url
    url: 'https://github.com/containerd/containerd/blob/main/docs/cri/registry.md'
    category: documentation
  - title: Teleport documentation
    type: url
    url: 'https://goteleport.com/docs/'
    category: documentation
---

