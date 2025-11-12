---
id: adobe-and-zapier
slug: adobe-and-zapier
title: Adobe & Zapier
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\". Learn more about Equinix Metal at https://rawkode.live/metal\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-04-29T17:00:00.000Z
technologies: []
show: klustered
videoId: xakqjecrktz236keekzkj3t7
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 113
    title: 'Introduction: Welcome to Clustered'
  - startTime: 134
    title: Thanking Sponsors (Teleport & Equinix Metal)
  - startTime: 207
    title: T-shirt Giveaway Announcement
  - startTime: 233
    title: Introducing Team Zapier
  - startTime: 270
    title: Team Zapier Introductions
  - startTime: 349
    title: Start of Team Zapier's Session
  - startTime: 371
    title: Accessing the Cluster (Zapier)
  - startTime: 435
    title: Initial Cluster Checks (Zapier)
  - startTime: 512
    title: Investigating Pending Pods
  - startTime: 573
    title: API Server Authentication Error Discovered
  - startTime: 640
    title: Checking for Admission Webhooks
  - startTime: 690
    title: Deleting a Validating Webhook
  - startTime: 759
    title: Revisiting API Server Errors
  - startTime: 889
    title: Looking at Taints and Scheduling
  - startTime: 909
    title: Worker Node Kubelet Issues
  - startTime: 1041
    title: Debugging Cilium Network Problems
  - startTime: 1113
    title: Investigating Image Pull Issues
  - startTime: 1175
    title: Identifying "Never" Pull Policy on Pod
  - startTime: 1320
    title: Debugging Image Pull Policy Source
  - startTime: 1647
    title: Mutation to "Never" Pull Policy Identified
  - startTime: 1699
    title: Searching for the Mutating Source
  - startTime: 1778
    title: Resource Quota Discovered
  - startTime: 1824
    title: Deleting Resource Quota
  - startTime: 1871
    title: Image Pulls Succeed
  - startTime: 1888
    title: Fixing Postgres Stateful Set
  - startTime: 2013
    title: 'Checking Network Policies (NetPol, CNP)'
  - startTime: 2051
    title: Identifying Problematic Cilium Network Policies
  - startTime: 2150
    title: Application Not Responding (Network/Cilium)
  - startTime: 2421
    title: Further Cilium Debugging
  - startTime: 2471
    title: Discovering More CNPs
  - startTime: 2531
    title: Deleting Problematic CNPs
  - startTime: 2577
    title: Application Responds Locally
  - startTime: 2585
    title: NodePort/External Access Issue
  - startTime: 2675
    title: Team Zapier Concludes Session
  - startTime: 2685
    title: Wrap-up with Team Zapier
  - startTime: 2738
    title: Introducing Team Adobe
  - startTime: 2828
    title: Team Adobe Introductions
  - startTime: 2927
    title: Start of Team Adobe's Session
  - startTime: 2958
    title: Accessing the Cluster (Adobe)
  - startTime: 3047
    title: Initial Cluster Checks (Adobe)
  - startTime: 3085
    title: Investigating Kubelet Failure
  - startTime: 3101
    title: Kubelet Permission Denied
  - startTime: 3145
    title: Fixing Kubelet Permissions
  - startTime: 3172
    title: Kubectl Still Failing
  - startTime: 3195
    title: API Server IP Mismatch Errors
  - startTime: 3278
    title: Identifying API Server Advertise Address Issue
  - startTime: 3396
    title: Wrong Kubectl Version Used Initially
  - startTime: 3478
    title: Fixing Kubectl Alias
  - startTime: 3490
    title: API Server Pod Not Running
  - startTime: 3575
    title: Checking Static Pod Manifests
  - startTime: 3626
    title: Unexpected Pod/ReplicaSet Manager Found
  - startTime: 3674
    title: Removing Unexpected ReplicaSet Manager
  - startTime: 3717
    title: ETCD Not Starting
  - startTime: 3731
    title: Debugging ETCD Failure (Expecting IP)
  - startTime: 3795
    title: Multiple Listen Peer URLs in ETCD Manifest
  - startTime: 3847
    title: Editing ETCD Manifest
  - startTime: 3936
    title: Restarting Kubelet (for ETCD changes)
  - startTime: 3955
    title: ETCD and API Server Running
  - startTime: 3992
    title: Kubectl Commands Working
  - startTime: 4025
    title: 'Cilium Issues (CrashLoop, Restarts)'
  - startTime: 4071
    title: Debugging Cilium Env Vars (KUBERNETES_SERVICE_HOST)
  - startTime: 4156
    title: Hardcoded Public IP in Cilium Deployment Env Var
  - startTime: 4194
    title: Fixing Cilium Environment Variable
  - startTime: 4267
    title: 'All Control Plane Pods Running, App Still Failing'
  - startTime: 4275
    title: Checking for Network Policies (Adobe)
  - startTime: 4305
    title: Deleting LimitRange
  - startTime: 4345
    title: Re-checking Cluster Objects
  - startTime: 4364
    title: Checking Service Object
  - startTime: 4372
    title: Service Port Mismatch (667 vs 666)
  - startTime: 4414
    title: Fixing Service Port
  - startTime: 4435
    title: Application Database Connection Error
  - startTime: 4450
    title: Checking Deployment DNS Config
  - startTime: 4490
    title: Hardcoded Postgres Hostname in App
  - startTime: 4500
    title: Removing Resource Limits (Deployment)
  - startTime: 4540
    title: Checking Kubelet DNS Config
  - startTime: 4576
    title: Debugging DNS Resolution (Dig)
  - startTime: 4590
    title: CoreDNS Config Map Typo ("health" vs "health")
  - startTime: 4609
    title: Fixing CoreDNS Config Map Typo
  - startTime: 4654
    title: Restarting CoreDNS
  - startTime: 4696
    title: Revisiting DNS Issues (Host Resolv.conf)
  - startTime: 4761
    title: Re-checking Kubelet DNS Config
  - startTime: 4805
    title: Checking Search Domain Config Map
  - startTime: 4876
    title: DNS Still Failing from Pod
  - startTime: 4942
    title: Kubernetes Service DNS Also Failing
  - startTime: 4967
    title: CoreDNS Config Map Reverted
  - startTime: 4979
    title: Suspecting External Reversion (Cron Job?)
  - startTime: 5002
    title: Creating New CoreDNS Config Map
  - startTime: 5066
    title: Deploying App with New CoreDNS Config
  - startTime: 5121
    title: Application Running Successfully (Fixed)
  - startTime: 5146
    title: Team Adobe Concludes Session
  - startTime: 5179
    title: Root Cause Revealed (Cloud Custodian)
  - startTime: 5187
    title: Wrap-up with Team Adobe
  - startTime: 5249
    title: Giveaway Winners (This Week)
  - startTime: 5271
    title: Giveaway Winners (Last Week)
  - startTime: 5303
    title: Outro
duration: 5384
---

