---
id: llclhowidfbrvg93zt05v77m
slug: klustered-18
title: 'Klustered #18'
description: >-
  Eric Smalling and Carlos Santana race the clock to debug broken Kubernetes
  clusters. Expect rogue static pods, ZomboCom surprises, broken Cilium network
  policies, CoreDNS misfires, and a mutating admission webhook swapping images.
whatYouWillLearn:
  - "Track down rogue static pods and remove stale manifests that block cluster startup and service health."
  - "Repair broken service networking by diagnosing Cilium, CoreDNS, kubelet state, and node IP table failures in sequence."
  - "Debug image and policy issues caused by admission webhooks, scheduler misconfiguration, and shell aliases that rewrite kubectl."
publishedAt: 2021-08-26T18:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - coredns
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 40
    title: Introductions
  - startTime: 61
    title: Introduction and Housekeeping
  - startTime: 112
    title: Guest Introductions (Eric & Carlos)
  - startTime: 231
    title: 'Challenge 1: Fixing Eric''s Cluster'
  - startTime: 240
    title: Cluster by Eric Smalling
  - startTime: 268
    title: Initial Cluster Check & Setup
  - startTime: 408
    title: Investigating Unexpected Static Pods
  - startTime: 533
    title: Diagnosing Service Connectivity
  - startTime: 738
    title: ZomboCom Discovery
  - startTime: 988
    title: Removing Static Pod Manifests
  - startTime: 1011
    title: Worker Node Connectivity Issue
  - startTime: 1052
    title: Removing Static Manifests via SSH
  - startTime: 1098
    title: Scaling Up Deployment
  - startTime: 1137
    title: Diagnosing Image Pull Error
  - startTime: 1291
    title: Fixing DNS and IP Tables
  - startTime: 1492
    title: Fixing IP Tables on Workers
  - startTime: 1555
    title: Deployment Pod Running
  - startTime: 1564
    title: Upgrade to v2 and App Check
  - startTime: 1635
    title: Eric's Hacks Revealed
  - startTime: 1800
    title: Cluster by Carlos Santana
  - startTime: 1871
    title: Cluster Check & Setup
  - startTime: 1971
    title: Diagnosing Stopped Kubelets
  - startTime: 2039
    title: Starting Kubelets
  - startTime: 2106
    title: Diagnosing Pending Pod (Wrong Image)
  - startTime: 2265
    title: Pod Image Mutation Found
  - startTime: 2400
    title: Discovering Missing Scheduler
  - startTime: 2799
    title: Fixing Missing Scheduler
  - startTime: 2903
    title: Removing Node Taints
  - startTime: 2930
    title: Image Still Wrong
  - startTime: 3000
    title: Diagnosing Database Crashes
  - startTime: 3076
    title: Diagnosing App Networking (Network Policy)
  - startTime: 3171
    title: Fixing Network Policy
  - startTime: 3227
    title: Database Image Wrong
  - startTime: 3444
    title: Using Hints
  - startTime: 3797
    title: Malicious kubectl Alias Found
  - startTime: 3940
    title: Deleting Mutating Webhook
  - startTime: 4008
    title: Pods Running Correctly
  - startTime: 4090
    title: Upgrade to v2 and App Check
  - startTime: 4158
    title: Carlos's Hacks Revealed
  - startTime: 4210
    title: Conclusion
duration: 4306
guests:
  - ericsmalling
  - csantanapr
resources:
  - title: InfluxDB Complete Guide course
    type: url
    category: other
  - title: Cloud Native TV search magic talk
    type: url
    category: other
---
