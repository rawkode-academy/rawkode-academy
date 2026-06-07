---
id: afzrby1hf2vpr1ist5fpg5sf
slug: klustered-15
title: 'Klustered #15'
description: >-
  Marek Counts and Abdel Sghiouar join David to debug two broken Kubernetes
  clusters, fixing containerd socket paths, kubelet misconfigurations, a rogue
  eBPF port blocker, a kubeconfig issue, and a Cilium NetworkPolicy blocking
  Postgres egress.
whatYouWillLearn:
  - "Repair cluster node readiness by fixing containerd socket path issues and validating kubelet and API-server connectivity."
  - "Diagnose and remove a rogue eBPF port blocker, then confirm firewall, iptables, and network policy behavior."
  - "Investigate unschedulable nodes, disk pressure, kubeconfig misconfigurations, and blocked Postgres egress with in-pod DNS checks."
publishedAt: 2021-07-01T17:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - containerd
  - ebpf
  - postgresql
  - coredns
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 124
    title: Guest Introductions (Marek & Abdel)
  - startTime: 210
    title: Cluster 33 by Marek Counts (@TheNullChannel)
  - startTime: 221
    title: Debugging Cluster 33 (Marek's) - Initial Cluster Check
  - startTime: 335
    title: Cluster 33 Problem Description (Reading the README)
  - startTime: 410
    title: Debugging Node 58ghnk (Easy)
  - startTime: 464
    title: Kubelet & Containerd Issues on 58ghnk
  - startTime: 565
    title: Locating & Fixing Containerd Socket Path
  - startTime: 785
    title: Verifying Node Status (58ghnk Ready)
  - startTime: 861
    title: Debugging Node vx4 (Medium)
  - startTime: 896
    title: Fixing Containerd Config Again on vx4
  - startTime: 1041
    title: Debugging vx4 Node Status (Still Not Ready)
  - startTime: 1594
    title: 'Identifying Kubelet Config Problems (Memory, RunOnce)'
  - startTime: 1834
    title: Fixing Kubelet Config on vx4
  - startTime: 1887
    title: Verifying Node Status (vx4 Ready)
  - startTime: 2012
    title: Identifying Pod Scheduling & Admission Errors on vx4
  - startTime: 2181
    title: Debugging Node zedpr (Hard)
  - startTime: 2268
    title: Checking Kubelet Logs & Connectivity to API Server
  - startTime: 2407
    title: Checking Firewalls & Network Policies on zedpr
  - startTime: 2680
    title: Hint about Cilium & eBPF
  - startTime: 2700
    title: Finding Rogue eBPF Process on zedpr
  - startTime: 2920
    title: Identifying & Fixing eBPF Port Blocker
  - startTime: 3051
    title: Cluster 33 Recap & Intro Cluster 34 (Abdel's)
  - startTime: 3060
    title: Cluster 34 by Abdel Sghiouar (@boredabdel)
  - startTime: 3167
    title: Debugging Node 4wglm (Easy)
  - startTime: 3260
    title: Identifying & Fixing Disk Pressure Issue
  - startTime: 3415
    title: Verifying Node Status (4wglm Ready)
  - startTime: 3476
    title: Debugging Node ghp7k (Medium)
  - startTime: 3652
    title: Identifying & Fixing Unschedulable Taint
  - startTime: 3671
    title: Verifying Node Status (ghp7k Ready)
  - startTime: 3764
    title: Debugging Node zxr6q (Hard)
  - startTime: 3856
    title: Checking Kubelet Logs & Network Unavailable Condition
  - startTime: 4017
    title: Checking IP Tables & Kubelet Config Check
  - startTime: 4270
    title: Finding Misconfigured Kubelet Kubeconfig
  - startTime: 4877
    title: Checking Application Connectivity Issue (Clustered to Postgres)
  - startTime: 5030
    title: Debugging Database Connection
  - startTime: 5251
    title: Checking In-Pod DNS Resolution
  - startTime: 5430
    title: Finding & Fixing NetworkPolicy Blocking Egress
  - startTime: 5670
    title: NetworkPolicy Explanation
  - startTime: 5732
    title: Wrap Up & Conclusion
duration: 5872
guests:
  - klaven
  - boredabdel
resources:
  - title: Rawkode Discord server
    type: url
    url: 'https://rawkode.chat'
    category: other
---
