---
id: klustered-21
slug: klustered-21
title: Klustered 21
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\"\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-03-05T17:00:00.000Z
technologies: []
show: klustered
videoId: kuzv09qa7pptdqchkv2ci5p9
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 79
    title: 'Intro, Sponsors & Guests'
  - startTime: 168
    title: Guest Introductions (Adrian & William)
  - startTime: 252
    title: Debugging Cluster 1 (Adyen's) Begins
  - startTime: 344
    title: 'Initial State: Pending Pods & NotReady Nodes'
  - startTime: 431
    title: Investigating CNI (Cilium) Issues
  - startTime: 1075
    title: Fixing Cilium Daemonset Image Typo
  - startTime: 1204
    title: 'Cluster Healthy, App Not Working'
  - startTime: 1230
    title: Attempting App V2 Upgrade
  - startTime: 1269
    title: App Connectivity Error (Postgres Lookup)
  - startTime: 1403
    title: Debugging Network Inside the Pod
  - startTime: 1531
    title: Investigating Cilium Config & Host IP Tables
  - startTime: 1874
    title: Flushing IP Tables & Restarting Cilium
  - startTime: 2146
    title: DNS Resolution Failure Confirmed
  - startTime: 2495
    title: Investigating Worker Node Services (Hint 3)
  - startTime: 2646
    title: Identifying & Fixing Rogue OMD Service (Resolv.conf Break)
  - startTime: 2977
    title: Cluster 1 Fixed (App V1)
  - startTime: 3040
    title: Debugging Cluster 2 (William's) Begins
  - startTime: 3152
    title: Attempting App V2 Upgrade (ETCD Permission Denied)
  - startTime: 3220
    title: Investigating ETCD Authentication Issues
  - startTime: 3481
    title: Debugging ETCD Client Access (`etcdctl`)
  - startTime: 4143
    title: Temporary ETCD Access Achieved
  - startTime: 4927
    title: 'Hint: ETCD Roles, Users & Root CN'
  - startTime: 5031
    title: Attempting to Disable ETCD Auth
  - startTime: 5068
    title: ETCD Fails to Start Due to Manifest Edit
  - startTime: 5114
    title: Correcting ETCD Static Manifest
  - startTime: 5470
    title: Generating Root Certificate for ETCD Client
  - startTime: 5687
    title: Using Root Cert to Access ETCD (Auth Success)
  - startTime: 5758
    title: 'App Still V1, Investigating Deployment State'
  - startTime: 5865
    title: 'Hint: Validating Webhook Preventing V2 Replica Set'
  - startTime: 6009
    title: Deleting Validating Webhook Configuration
  - startTime: 6128
    title: Debugging Pod Image & Pull Policy Again
  - startTime: 6167
    title: Identifying & Fixing Host DNS Issue (Resolv.conf Break Again)
  - startTime: 6319
    title: 'App Still V1, Deployment Spec Mismatch'
  - startTime: 6431
    title: Identifying & Forcing Deployment Spec Update (Server-Side Apply)
  - startTime: 6482
    title: Cluster 2 Fixed (App V2)
  - startTime: 6539
    title: Wrap Up & Debrief
duration: 6708
---

