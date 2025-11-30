---
id: hands-on-introduction-to-vcluster
slug: hands-on-introduction-to-vcluster
title: Hands-on Introduction to vcluster
description: "Curious about Kubernetes multi-tenancy? In this episode, we'll be guided through everything we need to know about vcluster.\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:20 - Introductions\n02:50 - What is vcluster?\n13:00 - Installing vcluster\n16:00 - How does vcluster work?\n46:30 - Deploying Different Kubernetes Versions as vcluster's\n\n\U0001F465 About the Guests\n\nRich Burroughs\n\n  Rich Burroughs is a Senior Developer Advocate at Loft Labs where he's focused on improving workflows for developers and platform engineers using Kubernetes. He's the creator and host of the Kube Cuddle podcast where he interviews members of the Kubernetes community. He is a founding organizer of DevOpsDays Portland, and he's helped organize other community events. Rich has a strong interest in how working in tech impacts mental health. He has ADHD and has documented his journey since being diagnosed on his Twitter.\n\n\n\U0001F426 https://twitter.com/richburroughs\n\U0001F9E9 https://github.com/richburroughs\n\n\n\nLukas Gentele\n\n  Lukas Gentele is the CEO of Loft Labs, Inc., a startup that builds open-source developer tooling for Kubernetes and helps companies with their transition from traditional to cloud-native software development. Before moving to San Francisco to start Loft Labs, Lukas founded a Kubernetes-focused consulting company in his home country Germany. He has previously spoken at conferences such as KubeCon, ContainerConf and Continuous Lifecycle, writes articles for journals such as heise and Better Programming, and likes to share his experiences at meetups.\n\n\n\U0001F426 https://twitter.com/LukasGentele\n\U0001F9E9 https://github.com/LukasGentele\n\n\n\n\U0001F528 About the Technologies\n\nvcluster\n\nvcluster - Virtual Clusters For Kubernetes\n    Lightweight & Low-Overhead - Based on k3s, bundled in a single pod and with super-low resource consumption\n    No Performance Degradation - Pod are scheduled in the underlying host cluster, so they get no performance hit at all while running\n    Reduced Overhead On Host Cluster - Split up large multi-tenant clusters into smaller vcluster to reduce complexity and increase scalability\n    Flexible & Easy Provisioning - Create via vcluster CLI, helm, kubectl, Argo any of your favorite tools (it is basically just a StatefulSet)\n    No Admin Privileges Required - If you can deploy a web app to a Kubernetes namespace, you will be able to deploy a vcluster as well\n    Single Namespace Encapsulation - Every vcluster and all of its workloads are inside a single namespace of the underlying host cluster\n    Easy Cleanup - Delete the host namespace and the vcluster plus all of its workloads will be gone immediately\n\n\n\U0001F30F https://www.vcluster.com/\n\n\U0001F9E9 https://github.com/loft-sh/vcluster"
publishedAt: 2021-06-23T17:00:00.000Z
technologies:
  - vcluster
show: rawkode-live
videoId: xv2v8qdigpu0kphaelrjmr5i
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 18
    title: Introduction
  - startTime: 20
    title: Introductions
  - startTime: 62
    title: Guest Introductions
  - startTime: 170
    title: What is vcluster?
  - startTime: 173
    title: What is vCluster?
  - startTime: 290
    title: Common Use Cases
  - startTime: 498
    title: 'Major Announcement: Certified Kubernetes'
  - startTime: 661
    title: Configuration and Flexibility
  - startTime: 755
    title: 'Getting Started: Deploying vCluster'
  - startTime: 780
    title: Installing vcluster
  - startTime: 958
    title: Examining the Host Cluster After Deployment
  - startTime: 960
    title: How does vcluster work?
  - startTime: 1065
    title: 'How vCluster Works: The Syncer and Resource Mapping'
  - startTime: 1329
    title: Security Considerations
  - startTime: 1490
    title: Connecting to the Virtual Cluster
  - startTime: 1515
    title: Namespaces in vCluster vs Host Cluster
  - startTime: 1736
    title: User Permissions Needed for vCluster
  - startTime: 1799
    title: Resource Synchronization Details
  - startTime: 1895
    title: Handling Storage and Host Resources
  - startTime: 2351
    title: Exploring Nodes Within the Virtual Cluster
  - startTime: 2649
    title: Running Different Kubernetes Versions in vCluster
  - startTime: 2790
    title: Deploying Different Kubernetes Versions as vcluster's
  - startTime: 2832
    title: 'Demo: Deploying Different vCluster Versions'
  - startTime: 2944
    title: Nested vClusters and Multiple Instances
  - startTime: 3394
    title: Networking and External Service Access
  - startTime: 3743
    title: Contributing and Getting Involved
  - startTime: 3771
    title: Cleaning Up vClusters
  - startTime: 3852
    title: Monitoring and Metrics
  - startTime: 3955
    title: Conclusion and Final Remarks
duration: 4078
---

