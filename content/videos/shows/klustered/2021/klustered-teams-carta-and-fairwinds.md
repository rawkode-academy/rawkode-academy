---
id: l7t356j2oeuhjpwdkt18tzzl
slug: klustered-teams-carta-and-fairwinds
title: 'Klustered Teams: Carta & Fairwinds'
description: >-
  Teams from Carta and Fairwinds debug each other's broken Kubernetes clusters
  live, tackling admission webhooks, rogue pod re-creation, kubelet and
  scheduler misconfigurations, an API server manifest typo, and a Cilium network
  policy.
whatYouWillLearn:
  - "Walk through live debugging of failing Kubernetes clusters, from broken node status to service-level outages."
  - "Diagnose admission webhook failures and broken pod recreation behavior to restore stable application state."
  - "Fix kubelet, scheduler, API server, and Cilium policy misconfigurations blocking database and network connectivity."
publishedAt: 2021-08-05T17:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - teleport
  - cilium
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 95
    title: Introductions
  - startTime: 99
    title: Introduction & Welcome
  - startTime: 170
    title: Team Carta
  - startTime: 177
    title: Introducing Team Carta
  - startTime: 340
    title: 'Starting Challenge 1: Debugging Fairwinds'' Cluster'
  - startTime: 501
    title: 'Initial Break: Incorrect `kubectl get nodes` Output'
  - startTime: 665
    title: Debugging Application Connectivity (Database Failure)
  - startTime: 926
    title: Identifying Admission Controllers
  - startTime: 1620
    title: Debugging Persistent Webhooks
  - startTime: 1805
    title: Debugging Rogue Pod Re-creation
  - startTime: 2606
    title: Consulting Challenge 1 Hints
  - startTime: 3254
    title: End of Challenge 1 Attempt
  - startTime: 3300
    title: Team Fairwinds
  - startTime: 3321
    title: Introducing Team Fairwinds
  - startTime: 3463
    title: Debrief of Challenge 1 (Fairwinds Explains the Breaks)
  - startTime: 3591
    title: 'Starting Challenge 2: Debugging Carta''s Cluster'
  - startTime: 3601
    title: 'Initial Break: Cannot Access Nodes'
  - startTime: 3695
    title: Missing Pods & Deployment State Mismatch
  - startTime: 3904
    title: Identifying Worker Node Taint
  - startTime: 4267
    title: 'Using Hint 1: Fixing Kubeconfig'
  - startTime: 4350
    title: Debugging Scheduler Errors in Logs
  - startTime: 4743
    title: Debugging Kubelet Configuration
  - startTime: 4948
    title: Identifying API Server Manifest Typo
  - startTime: 5131
    title: Finding Disabled Controllers
  - startTime: 5200
    title: Application V2 Running (Goal 1 Achieved)
  - startTime: 5256
    title: Debugging Database Connectivity
  - startTime: 5552
    title: 'Using Hint 5: Fixing Scheduler Name Typo'
  - startTime: 5637
    title: Database Pod Running
  - startTime: 5650
    title: Debugging Service Connectivity (Continued)
  - startTime: 5785
    title: Fixing Cilium Network Policy
  - startTime: 5829
    title: Application Fully Fixed (Challenge 2 Complete)
  - startTime: 5847
    title: Wrap-up & Conclusion
duration: 5929
guests:
  - saada
  - inanimate
  - rachel-sweeney
  - sudermanjr
  - lucasreed
  - denraf
resources:
  - title: Teleport
    type: url
    url: 'https://rawkode.live/teleport'
    category: other
  - title: Fairwinds RBAC Lookup
    type: url
    url: 'https://github.com/FairwindsOps/rbac-lookup'
    category: code
---
