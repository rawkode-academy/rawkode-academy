---
id: dxxgafdnayd30spjingobsv8
slug: klustered-part-vii
title: Klustered (Part VII)
description: >-
  Klustered is a series of live streams in which myself and a guest join forces
  to fix "broken" Kubernetes clusters ... on the clock.
publishedAt: 2021-04-01T18:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: klustered
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 180
    title: Introductions
  - startTime: 196
    title: 'Introduction, Show Premise & Housekeeping'
  - startTime: 280
    title: 'Introducing Guest: Guinevere Zinger'
  - startTime: 476
    title: Starting Debugging on Cluster 14 (Broken by Phil)
  - startTime: 480
    title: Kluster 014
  - startTime: 618
    title: 'Initial Cluster 14 State: Missing App Pod in Default Namespace'
  - startTime: 657
    title: 'Checking Pods in All Namespaces (Cilium, Kiverno, etc.)'
  - startTime: 762
    title: 'Investigating Stuck Pod: Cilium CNI Plugin Error'
  - startTime: 3480
    title: Kluster 015
  - startTime: 3735
    title: 'Failed App Deployment: ETCD Request Too Large Error'
  - startTime: 3977
    title: Fixing ETCD Max Request Bytes Configuration
  - startTime: 4146
    title: Pod Stuck in Terminating State
  - startTime: 4219
    title: Node Not Ready / Kubelet Issues Identified
  - startTime: 4385
    title: Investigating Kubelet Systemd Service File and Logs
  - startTime: 4620
    title: Finding Kubelet Feature Gate Error (CPUCFSQuotaPeriod)
  - startTime: 4645
    title: Fixing Kubelet Config Error
  - startTime: 4721
    title: 'Nodes Ready, Pods Stuck in Pending (Scheduler Issue)'
  - startTime: 4740
    title: Redeploying App and Discovering Deployment Failures
  - startTime: 4839
    title: Confirming Pods Have No Assigned Node
  - startTime: 4877
    title: 'Finding Admission Controller Errors (Mutating Webhooks, PSP)'
  - startTime: 5086
    title: Deleting Kiverno Mutating Webhooks (Distraction)
  - startTime: 5249
    title: 'Hint from Guy: Revisit Scheduler Configuration'
  - startTime: 5287
    title: Identifying Pod Security Policy Errors
  - startTime: 5400
    title: Deleting Suspicious Pod Security Policy
  - startTime: 5521
    title: 'Pod Security Policy Still Blocking: Checking API Server Config'
  - startTime: 5643
    title: Discovering Custom Scheduler Name Configuration
  - startTime: 5663
    title: Fixing Scheduler Configuration
  - startTime: 5730
    title: 'Cluster 12: Pods Now Scheduling & Starting (Scheduler Problem Solved)'
  - startTime: 5886
    title: Disabling Pod Security Policy Admission Controller in API Server
  - startTime: 6069
    title: App Running But Cannot Connect to Database (Connection Refused)
  - startTime: 6098
    title: 'Cluster 14: Pods Start Running (Initial Problem Solved)'
  - startTime: 6186
    title: App Logs Show DNS Lookup Failure
  - startTime: 6195
    title: Checking CoreDNS Pods and Logs
  - startTime: 6521
    title: Noticing Pods/Services on Different IP Ranges
  - startTime: 6880
    title: Checking Cilium Config Map (Pod CIDR vs Host Network)
  - startTime: 7087
    title: Starting Debugging on Cluster 12 (Broken by Guy)
  - startTime: 7117
    title: 'Discovering `hostNetwork: true` on App Pod (Minor Issue/Red Herring)'
  - startTime: 7140
    title: 'Initial Cluster 12 State: App & Postgres Pods Running, Seeing Unknown Pods'
  - startTime: 7620
    title: 'Hint from Guy: Check CoreDNS Config Map for Small Typo'
  - startTime: 7896
    title: Identifying the CoreDNS Config Map Typo (`clouster.local`)
  - startTime: 8284
    title: Fixing CoreDNS Config Map Typo
  - startTime: 8323
    title: 'Cluster 12: App Works (DNS Problem Solved)'
  - startTime: 8341
    title: Conclusion and Thanks
duration: 8440
guests:
  - guinevere-saenger
---

