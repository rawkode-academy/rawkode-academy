---
id: b5ezd2815ffos2t8d3h2qljv
slug: 22-borko-vs-bojan
title: 22. Borko Vs. Bojan
description: >-
  Identical twins Borko and Bojan tackle broken Kubernetes clusters. Borko hunts
  a malformed image name and a Cilium deny policy, then fixes a CoreDNS rewrite.
  Bojan kills a cron job flushing iptables and repairs a bad Postgres startup
  probe.
publishedAt: 2022-03-11T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - coredns
  - postgresql
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 78
    title: Introduction and Welcome
  - startTime: 125
    title: 'Sponsor Thanks (Teleport, Equinix Metal)'
  - startTime: 171
    title: Guest Introductions (Borko and Bojan)
  - startTime: 326
    title: Preparing for Borko's Challenge
  - startTime: 342
    title: Borko Begins Debugging
  - startTime: 361
    title: Initial Cluster Check and Pod Status
  - startTime: 446
    title: Debugging "Invalid Image Name"
  - startTime: 607
    title: Attempting a "Sledgehammer" Fix (Deleting Replica Sets)
  - startTime: 699
    title: Analyzing Pod Events and Image Format
  - startTime: 797
    title: Retyping the Image Name (Fixing Unicode?)
  - startTime: 861
    title: Testing the Application (Database Timeout)
  - startTime: 929
    title: Debugging Database Connection Issues
  - startTime: 1106
    title: Checking Network Policies
  - startTime: 1170
    title: Discovering and Deleting a Deny Policy (CCNP)
  - startTime: 1208
    title: 'Application Still Failing: New Error ("Failed to Look Up Address")'
  - startTime: 1251
    title: Investigating CoreDNS Configmap
  - startTime: 1309
    title: Finding and Editing a CoreDNS Rewrite Rule
  - startTime: 1373
    title: Restarting CoreDNS Pods for ConfigMap Changes
  - startTime: 1452
    title: Application Works (V2 Detected)
  - startTime: 1462
    title: Borko's Challenge Debrief
  - startTime: 1526
    title: Preparing for Bojan's Challenge
  - startTime: 1556
    title: Bojan Begins Debugging
  - startTime: 1577
    title: Initial Cluster Check (Control Plane Issues)
  - startTime: 1671
    title: Checking Running Processes with `ps`
  - startTime: 1708
    title: API Server Missing from Processes
  - startTime: 1753
    title: Examining Static Manifests and Suspicious Processes
  - startTime: 1837
    title: Identifying the IP Tables Lock Script & Cron Job Break
  - startTime: 1907
    title: Editing Cron Tab to Remove the Script
  - startTime: 2038
    title: Confirming Script Removal
  - startTime: 2045
    title: Still No API Server; Flushing IP Tables
  - startTime: 2128
    title: Restarting Kubelet
  - startTime: 2175
    title: API Server Starts; Checking Pods (Cilium Crash Loop)
  - startTime: 2347
    title: Cilium Recovering; Custard Pod Healthy
  - startTime: 2402
    title: Testing Application V1 (Database Timeout Again)
  - startTime: 2530
    title: Discovering and Fixing the Postgres Startup Probe
  - startTime: 2640
    title: Correcting Edit (Deletion/Indentation)
  - startTime: 2692
    title: Applying Postgres Fix
  - startTime: 2700
    title: Application V1 Works
  - startTime: 2706
    title: Updating Custard Deployment to V2
  - startTime: 2727
    title: Application V2 Works
  - startTime: 2736
    title: Bojan's Challenge Debrief
  - startTime: 2885
    title: Conclusion and Thanks
  - startTime: 14689
    title: 'Debugging V1 Database Connection: Checking Postgres Deployment'
duration: 2978
guests:
  - borkod
  - bojand
resources:
  - title: Teleport
    type: url
    url: 'https://goteleport.com/'
    category: other
---

