---
id: mkpg23vllzcc5ld4672zgzgv
slug: klustered-teams-giant-swarm-and-wildlife-studios
title: Klustered Teams - Giant Swarm & Wildlife Studios
description: >-
  We use Teleport every week on Klustered and we encourage you to try it out
  too. Check them out at https://rawkode.live/teleport
publishedAt: 2022-02-17T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 105
    title: Welcome and Intro to Clustered
  - startTime: 141
    title: 'Sponsor Shout-outs (Teleport, Equinix Metal)'
  - startTime: 191
    title: Introducing Team Giant Swarm
  - startTime: 256
    title: Starting Debugging Session 1 (Wildlife Studios' cluster)
  - startTime: 334
    title: Initial Cluster Health Check (kubectl)
  - startTime: 408
    title: Identifying Crashing App Pod
  - startTime: 467
    title: Attempting Image Update (v1 to v2)
  - startTime: 630
    title: Debugging Pod Probes
  - startTime: 673
    title: Removing Probes and Resource Limits
  - startTime: 1179
    title: App Pod Still Crashlooping (Observing 30-second loop)
  - startTime: 1320
    title: Considering Looking Beyond Kubernetes
  - startTime: 1448
    title: 'Hint: Network Timeout Suspected (from chat)'
  - startTime: 1551
    title: Checking Kubelet Logs (Failed to Start Container)
  - startTime: 1731
    title: Investigating Node Processes (Suspicious Sleep)
  - startTime: 1854
    title: Attempting Pod Reschedule (to Control Plane)
  - startTime: 2135
    title: Requesting First Hint (Pause Container)
  - startTime: 2458
    title: Debugging Pause Container Image
  - startTime: 2563
    title: Removing Tampered Pause Image (crictl)
  - startTime: 2638
    title: Debugging Service/Network Connectivity (Curl Timeout)
  - startTime: 2719
    title: Checking Network Policies (Cilium)
  - startTime: 2780
    title: Checking Cilium ConfigMap (`enable-policy`)
  - startTime: 2867
    title: Attempting to Fix Cilium Configuration
  - startTime: 3077
    title: Time Runs Out for Team Giant Swarm
  - startTime: 3125
    title: Introducing Team Wildlife Studios
  - startTime: 3248
    title: Wildlife Studios Explains Cluster 1 Problems (Cilium & CNI Spoofing)
  - startTime: 3431
    title: Starting Debugging Session 2 (Giant Swarm's cluster)
  - startTime: 3485
    title: Debugging kubectl Binary (Found replaced binary)
  - startTime: 3614
    title: API Server Not Running
  - startTime: 3689
    title: Checking Kubelet Status & Logs
  - startTime: 3790
    title: Checking Kubelet Config Files
  - startTime: 3922
    title: 'Kubelet Failure: Image Pull Error (DNS Issue)'
  - startTime: 3977
    title: 'Debugging DNS Resolution (/etc/resolv.conf, dig)'
  - startTime: 4152
    title: Checking /etc/hosts File (K8s Registry Mapping)
  - startTime: 4241
    title: Fixing /etc/hosts
  - startTime: 4307
    title: Image Pull Successful (DNS Fixed)
  - startTime: 4337
    title: API Server Still Not Running (Cluster IP Range Mismatch)
  - startTime: 4408
    title: Checking API Server Manifest
  - startTime: 4446
    title: Fixing Service Cluster IP Range
  - startTime: 4576
    title: Forcing API Server Restart
  - startTime: 4705
    title: 'API Server Starting, Checking Logs (Etcd Connect Failed)'
  - startTime: 4832
    title: Etcd Not Running
  - startTime: 4841
    title: Checking Etcd Manifest
  - startTime: 5039
    title: Requesting Hints for Cluster 2
  - startTime: 5073
    title: 'Applying Hint: Flush IPtables'
  - startTime: 5113
    title: Lost SSH Access (IPtables Default Policy Suspected)
  - startTime: 5432
    title: Testing IPtables Flush (Confirms Default Policy Issue)
  - startTime: 5515
    title: Explaining IPtables Default Policy Problem
  - startTime: 5687
    title: Ending Debugging Session 2
  - startTime: 5700
    title: Wildlife Studios Explains Cluster 2 Problems (Giant Swarm's cluster)
  - startTime: 6066
    title: Giant Swarm Explains Cluster 2 Problems (Wildlife Studios' cluster)
  - startTime: 6333
    title: Conclusion and Farewell
duration: 6382
resources: []
---

