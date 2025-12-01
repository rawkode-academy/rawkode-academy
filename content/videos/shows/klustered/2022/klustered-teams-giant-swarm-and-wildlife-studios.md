---
id: klustered-teams-giant-swarm-and-wildlife-studios
slug: klustered-teams-giant-swarm-and-wildlife-studios
title: Klustered Teams - Giant Swarm & Wildlife Studios
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\"\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-02-17T17:00:00.000Z
technologies: []
show: klustered
videoId: mkpg23vllzcc5ld4672zgzgv
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
---

