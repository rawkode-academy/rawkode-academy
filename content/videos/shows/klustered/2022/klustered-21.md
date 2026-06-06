---
id: kuzv09qa7pptdqchkv2ci5p9
slug: klustered-21
title: Klustered 21
description: >-
  Two broken clusters from Adyen and William. Debug a Cilium CNI image typo,
  chase a rogue service rewriting resolv.conf, then unpick etcd client auth, a
  validating webhook blocking a new ReplicaSet, and a server-side apply fix.
publishedAt: 2022-03-05T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - etcd
  - coredns
  - helm
  - postgresql
  - teleport
show: klustered
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
guests:
  - kassah
resources:
  - title: Rawkode Chat
    type: url
    url: 'https://rawkode.chat'
    category: other
  - title: Teleport
    type: url
    url: 'https://goteleport.com/'
    category: other
  - title: Cilium
    type: url
    url: 'https://cilium.io/'
    category: other
  - title: etcd documentation
    type: url
    url: 'https://etcd.io/docs/'
    category: documentation
  - title: CoreDNS
    type: url
    url: 'https://coredns.io/'
    category: other
---

