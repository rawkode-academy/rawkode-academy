---
id: j6uehaw57ynwqnbkjs3m1to6
slug: klustered-part-ii
title: Klustered (Part II)
description: >-
  Dan Finneran joins Rawkode to debug two broken Kubernetes clusters, unpicking
  an etcd version mismatch, a bad kubelet flag, an etcd "no space" alarm and
  quota, a block-all NetworkPolicy, and a PodSecurityPolicy affecting static
  pods.
publishedAt: 2021-02-25T12:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - etcd
  - cilium
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 71
    title: Introduction and Guest Welcome (Dan Finnerin)
  - startTime: 176
    title: Recap of Last Week's Clustered Challenges
  - startTime: 405
    title: Debugging the Wrong / Working Kluster (Oops)
  - startTime: 460
    title: Starting with Jason's Cluster (Cluster 3)
  - startTime: 608
    title: 'Initial Cluster 3 Checks (Workload, Pods)'
  - startTime: 1007
    title: 'Realization: Cluster 3 is Healthy'
  - startTime: 1072
    title: Switching to Waleed's Broken Cluster (Cluster 5)
  - startTime: 1075
    title: Kluster 004 - Broken by Jason DeTiberus (@detiber)
  - startTime: 1105
    title: 'Cluster 5 Initial State: Unready Nodes'
  - startTime: 1141
    title: 'Debugging Node Issues: Checking Kubelet Status and Logs'
  - startTime: 1337
    title: ETCD and API Server Issues on Node 1
  - startTime: 1539
    title: Examining ETCD Manifest (Node 1)
  - startTime: 1841
    title: 'Identified & Fixed: ETCD Version Mismatch (Node 1)'
  - startTime: 1999
    title: Checking API Server After ETCD Fix Attempt
  - startTime: 2165
    title: Debugging Worker Node Kubelet Issue
  - startTime: 2300
    title: 'Identified: Kubelet Unknown Flag (`bootstrap-kubeconfig`)'
  - startTime: 2392
    title: Examining Kubelet Configuration Files
  - startTime: 2435
    title: Fixing Kubelet Configuration (Removing Flag)
  - startTime: 3027
    title: 'Hint: Check Kubelet Version'
  - startTime: 3290
    title: 'Identified & Fixed: Old Kubelet Binary Version'
  - startTime: 3383
    title: Cluster 5 Nodes Becoming Ready (After Kubelet Fix)
  - startTime: 3440
    title: Kluster 005 - Broken by Walid Shaari (@walidshaari)
  - startTime: 3510
    title: Reading Cluster 5 Readme Hint
  - startTime: 3595
    title: Cluster 5 Status After Initial Node Fixes
  - startTime: 3725
    title: '`kubectl get nodes` Times Out (Investigating ETCD)'
  - startTime: 3783
    title: Examining ETCD Logs (Node 1)
  - startTime: 3815
    title: 'Identified: ETCD "No Space" Alarm'
  - startTime: 3849
    title: Examining ETCD Manifest for Volume Configuration
  - startTime: 4213
    title: Using ETCD CTL to Query Status
  - startTime: 4315
    title: 'ETCD CTL Status Shows Healthy, But Alarm Exists'
  - startTime: 4385
    title: Getting ETCD DB Size & Attempting Compaction
  - startTime: 4967
    title: Hint & Examining ETCD Manifest for Quota
  - startTime: 5091
    title: Fixing ETCD Quota Setting
  - startTime: 5471
    title: ETCD Logs Still Show "No Space" Alarm
  - startTime: 5697
    title: 'Hint: Check ETCD Alarms'
  - startTime: 5767
    title: Disarming ETCD Alarms
  - startTime: 5796
    title: ETCD Status Healthy After Alarm Fix
  - startTime: 5810
    title: Cluster 5 Overall Status Check
  - startTime: 5939
    title: Testing Internal Pod Connectivity (Failure)
  - startTime: 5981
    title: 'Identified: Missing CoreDNS and Control Plane Pods'
  - startTime: 6204
    title: Troubleshooting Missing Control Plane Pods (Logs)
  - startTime: 6663
    title: 'Hint: Check Network Policies'
  - startTime: 6695
    title: 'Identified & Deleted: "Block All" Network Policy'
  - startTime: 6751
    title: 'Hint: Check Pod Security Policies'
  - startTime: 6795
    title: 'Identified & Deleted: PSP Affecting Static Pods'
  - startTime: 6878
    title: 'Final Hint: Check Kernel Settings (Sysctl)'
  - startTime: 6961
    title: Conceding Failure on Final Issue
  - startTime: 6978
    title: Conclusion and Wrap-up
duration: 7085
guests:
  - dan-finneran
resources:
  - title: Hubble UI
    type: url
    url: 'https://docs.cilium.io/en/stable/observability/hubble/hubble-ui/'
    category: documentation
---

