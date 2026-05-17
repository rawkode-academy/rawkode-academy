---
id: x372c0fhltxzq4h7ll4mfqh1
slug: klustered-14
title: 'Klustered #14'
description: >-
  Sid Palas and Arian van Putten each break a cluster for the other to fix.
  Cluster 31 hides a kubelet cgroup driver mismatch starving Postgres and
  Cilium, while Cluster 32 spawns replicating "not-a-virus" pods across rogue
  namespaces.
publishedAt: 2021-06-10T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - postgresql
  - docker
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 55
    title: Introductions
  - startTime: 72
    title: Housekeeping & Call to Action
  - startTime: 98
    title: Guest Introductions
  - startTime: 232
    title: 'Challenge 1: Sid''s Cluster (Cluster 31)'
  - startTime: 235
    title: Cluster 31 by Arian van Putten (@ProgrammerDude)
  - startTime: 333
    title: 'Initial Cluster State: Pods Unhealthy'
  - startTime: 346
    title: Diagnosing Postgres Scheduling Issue
  - startTime: 424
    title: Examining Worker Node Status
  - startTime: 447
    title: 'Worker Node: Memory and Kubelet Config'
  - startTime: 701
    title: Attempting to Remove Node Taint
  - startTime: 821
    title: Taint Reappears
  - startTime: 890
    title: Discovering NGINX Pod Evictions
  - startTime: 934
    title: Deleting Rogue NGINX Deployment
  - startTime: 1000
    title: Taint Persistence & Webhook Check
  - startTime: 1431
    title: Kubelet Cgroup Driver Issue Identified
  - startTime: 1957
    title: Attempting to Fix Cgroup Driver Issue
  - startTime: 2356
    title: Checking Networking & Port Forward
  - startTime: 2420
    title: Restarting Cilium Pods
  - startTime: 2522
    title: Restarting Control Plane Kubelet
  - startTime: 2701
    title: Verifying Kubelet Fixes & Status
  - startTime: 2810
    title: Confirming Service and Networking
  - startTime: 2887
    title: Upgrading Clustered App to V2
  - startTime: 2928
    title: Verifying V2 Upgrade (Success!)
  - startTime: 2990
    title: Explanation of Cluster 1 Issues
  - startTime: 3180
    title: Cluster 32 by Sid Palas (@sidpalas)
  - startTime: 3185
    title: 'Transition to Challenge 2: Adrian''s Cluster'
  - startTime: 3205
    title: 'Initial Cluster State: Clustered Pod Missing'
  - startTime: 3232
    title: Diagnosing and Fixing Replica Count
  - startTime: 3305
    title: '"Not a Virus" Pods Appear & Replicate'
  - startTime: 3407
    title: Investigating Source of Replication
  - startTime: 3603
    title: Examining Rogue Pod Details & API Access
  - startTime: 3700
    title: Analyzing Rogue Namespaces by Age
  - startTime: 3932
    title: Re-examining Clustered Pod as Trigger
  - startTime: 4311
    title: Searching for Rogue Process on Nodes
  - startTime: 5164
    title: Accessing the Rogue Container
  - startTime: 5440
    title: Examining Rogue Container Files (README)
  - startTime: 5521
    title: Stopping the Rogue Container (Source of Replication)
  - startTime: 5544
    title: Cleaning Up Rogue Namespaces
  - startTime: 5656
    title: Accelerating Cleanup and Redeploying Workloads
  - startTime: 5930
    title: Adding Tolerations & Redeploying Clustered/Postgres
  - startTime: 6063
    title: Upgrading Clustered App to V2 (Success)
  - startTime: 6103
    title: Explanation of Cluster 2 Brokenness & Conclusion
duration: 6357
guests:
  - sid-palas
  - arian-van-putten
resources:
  - title: DevOps Directive YouTube channel
    type: url
    url: 'https://www.youtube.com/c/DevOpsDirective'
    category: other
---

