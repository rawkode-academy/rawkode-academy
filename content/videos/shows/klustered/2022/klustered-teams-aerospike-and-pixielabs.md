---
id: klustered-teams-aerospike-and-pixielabs
slug: klustered-teams-aerospike-and-pixielabs
title: Klustered Teams - Aerospike & PixieLabs
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\". Learn more about Equinix Metal at https://rawkode.live/metal\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-04-14T17:00:00.000Z
technologies: []
show: klustered
videoId: jtqwn91v0x5dxjuy02z7a8j8
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 122
    title: Introduction & Giveaway Info
  - startTime: 161
    title: 'Sponsor Thanks (Teleport, Equinix Metal)'
  - startTime: 235
    title: Introducing Team Aerospike
  - startTime: 337
    title: Team Aerospike Begins Debugging
  - startTime: 407
    title: Investigating No Control Plane / API Server
  - startTime: 706
    title: Investigating API Server Ports & Logs
  - startTime: 801
    title: Investigating etcd Connection & Certs
  - startTime: 982
    title: etcd Permission Denied & Red Herring Hint
  - startTime: 1263
    title: 'Hint: Check Root Directory (File Permissions)'
  - startTime: 1391
    title: Discovering & Disabling etcd Authentication
  - startTime: 1546
    title: API Server Starts
  - startTime: 1559
    title: Nodes Not Ready
  - startTime: 1710
    title: Debugging Node Status / Removing Taints
  - startTime: 1786
    title: Nodes Become Ready
  - startTime: 1868
    title: Checking Service Status (v1 Working)
  - startTime: 1885
    title: Attempting to Update to V2
  - startTime: 1934
    title: Discovering ImagePullPolicy 'Never'
  - startTime: 2039
    title: Image Pull Back Off (V2)
  - startTime: 2082
    title: Checking Worker Node & Container Runtime
  - startTime: 2176
    title: Investigating Registry Certificate / DNS Issue
  - startTime: 2253
    title: Fixing Hosts File (DNS)
  - startTime: 2347
    title: Pod Stuck in Backoff
  - startTime: 2362
    title: V2 Pod Running & Service Working
  - startTime: 2405
    title: Team Aerospike Success & Debrief
  - startTime: 2471
    title: Transition to Team Pixielabs
  - startTime: 2515
    title: Team Pixielabs Explains Breaks
  - startTime: 2610
    title: Introducing Team Pixielabs & Product
  - startTime: 3657
    title: Why the Api Server Was Not Started
  - startTime: 3663
    title: Cni Plugin Not Initialized
  - startTime: 4189
    title: Error Logs
  - startTime: 6333
    title: Team Pixielabs Begins Debugging
  - startTime: 6370
    title: Competition Winners
  - startTime: 6417
    title: Investigating No Control Plane / API Server (Pixie)
  - startTime: 6630
    title: Finding Incorrect etcd Port in Manifest
  - startTime: 6708
    title: Fixing etcd Port in Manifest
  - startTime: 6938
    title: Kubelet Cannot Process Suspicious Manifest (`delete-me.yaml`)
  - startTime: 6966
    title: Discussing & Removing `delete-me.yaml`
  - startTime: 7297
    title: Fixing YAML Parsing Errors
  - startTime: 7576
    title: Checking Kubelet Configuration & Logs
  - startTime: 8258
    title: 'Discovering `maxPods: 1` Setting'
  - startTime: 8340
    title: Investigating Excessive Pod Creation
  - startTime: 8451
    title: Investigating Worker Node Kubelet Issues
  - startTime: 8557
    title: Finding Incorrect Containerd Socket Path
  - startTime: 8621
    title: Fixing Containerd Config
  - startTime: 8762
    title: Discovering Kubelet Run-Once Setting
  - startTime: 8800
    title: 'Hint: Remove Kubelet Run-Once'
  - startTime: 8904
    title: Fixing systemd Unit Run-Once
  - startTime: 10835
    title: Discovering & Bypassing Broken Scheduler (`nodeName`)
  - startTime: 11860
    title: 'Finding Worker Node `maxPods: 1`'
  - startTime: 12100
    title: 'Reviewing Pods & Pending Issues (Scheduler, Resources, Port)'
  - startTime: 12194
    title: Investigating Port Conflict (NGINX)
  - startTime: 12398
    title: Calling for Explanation / Cluster is Dumpster Fire
  - startTime: 12419
    title: 'Hint: /run Partition is Full'
  - startTime: 12440
    title: Calling Time / Multiple Unsolved Breaks
  - startTime: 12479
    title: Pixielabs Debrief / Reflection
  - startTime: 12601
    title: Giveaway Drawing
  - startTime: 12671
    title: Conclusion / Winners Announced
duration: 6472
---

