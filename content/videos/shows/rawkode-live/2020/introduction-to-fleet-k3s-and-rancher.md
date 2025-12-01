---
id: introduction-to-fleet-k3s-and-rancher
slug: introduction-to-fleet-k3s-and-rancher
title: 'Introduction to Fleet, k3s, & Rancher'
description: "In this episode, I am joined by Bastian Hofmann (Field Engineer at Rancher); Bastian will be introducing us to Fleet.\n\nFleet is GitOps at scale. Fleet is designed to manage up to a million clusters. It's also lightweight enough that is works great for a single cluster too, but it really shines when you get to a large scale. By large scale we mean either a lot of clusters, a lot of deployments, or a lot of teams in a single organization.\n\nFleet can manage deployments from git of raw Kubernetes YAML, Helm charts, or Kustomize or any combination of the three. Regardless of the source all resources are dynamically turned into Helm charts and Helm is used as the engine to deploy everything in the cluster. This give a high degree of control, consistency, and auditability. Fleet focuses not only on the ability to scale, but to give one a high degree of control and visibility to exactly what is installed on the cluster.\n\nK3s is a fully compliant Kubernetes distribution with the following enhancements:\n\n    Packaged as a single binary.\n    Lightweight storage backend based on sqlite3 as the default storage mechanism. etcd3, MySQL, Postgres also still available.\n    Wrapped in simple launcher that handles a lot of the complexity of TLS and options.\n    Secure by default with reasonable defaults for lightweight environments.\n    Simple but powerful “batteries-included” features have been added, such as: a local storage provider, a service load balancer, a Helm controller, and the Traefik ingress controller.\n    Operation of all Kubernetes control plane components is encapsulated in a single binary and process. This allows K3s to automate and manage complex cluster operations like distributing certificates.\n    External dependencies have been minimized (just a modern kernel and cgroup mounts needed). K3s packages required dependencies, including:\n        containerd\n        Flannel\n        CoreDNS\n        CNI\n        Host utilities (iptables, socat, etc)\n        Ingress controller (traefik)\n        Embedded service loadbalancer\n        Embedded network policy controller\n\n\n\U0001F570    Timeline\n\n00:00 - Holding screen\n02:20 - Introductions\n04:00 - Slides (What is Rancher, Fleet, k3s)\n14:00 - Starting to gets hands on - a look at our hardware\n14:50 - Installing single-node k3s on our first machine\n20:50 - Installing and playing with Rancher\n33:00 - Upgrading k3s clusters with Rancher\n39:30 - Installing a multi-node / HA k3s cluster with etcd\n45:20 - Using the Rancher integrated monitoring\n40:30 - GitOps workloads with Fleet\n\n1:16:00 - Recap\n\n\n\n\n\U0001F481\U0001F3FB‍♂️    Want some help?\n\n\U0001F4AC  Leave a comment\n\U0001F426  Ping me on Twitter - https://twitter.com/rawkode\n\U0001F4C6  Schedule some time during my office-hours - https://rawko.de/office-hours\n\n\n\U0001F30E    Links\n\nBastian Hofmann - https://twitter.com/BastianHofmann\nRancher - https://github.com/rancher/rancher\nFleet - https://github.com/rancher/fleet\nk3s - https://github.com/rancher/k3s"
publishedAt: 2020-10-01T17:00:00.000Z
technologies:
  - fleet
  - k3s
  - rancher
show: rawkode-live
videoId: lb438p217zya3imz0gaex2gb
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 140
    title: Introductions
  - startTime: 147
    title: Introduction and Agenda
  - startTime: 221
    title: Guest Introduction and Overview of Tools
  - startTime: 240
    title: 'Slides (What is Rancher, Fleet, k3s)'
  - startTime: 359
    title: What is k3s? (Lightweight Kubernetes)
  - startTime: 545
    title: What is Rancher? (Multi-Cluster Management)
  - startTime: 840
    title: Starting to gets hands on - a look at our hardware
  - startTime: 890
    title: Installing single-node k3s on our first machine
  - startTime: 1250
    title: Installing and playing with Rancher
  - startTime: 1980
    title: Upgrading k3s clusters with Rancher
  - startTime: 2370
    title: Installing a multi-node / HA k3s cluster with etcd
  - startTime: 2720
    title: Using the Rancher integrated monitoring
  - startTime: 4264
    title: What is Fleet? (Multi-Cluster GitOps)
  - startTime: 4445
    title: 'Hands-on: Setting up the Environment'
  - startTime: 4486
    title: Installing k3s for Rancher
  - startTime: 4560
    title: Recap
  - startTime: 4807
    title: Installing Helm
  - startTime: 4897
    title: Preparing Rancher Installation (TLS Setup)
  - startTime: 4947
    title: Installing Cert-Manager
  - startTime: 5046
    title: Installing Rancher via Helm
  - startTime: 5227
    title: Rancher Initial Setup and UI Overview
  - startTime: 5560
    title: Preparing to Add More Clusters
  - startTime: 5662
    title: Installing Additional k3s Clusters (Older Version for Upgrade Test)
  - startTime: 6004
    title: Setting up a k3s HA Cluster
  - startTime: 6240
    title: Importing Clusters into Rancher
  - startTime: 6342
    title: Activating Integrated Monitoring
  - startTime: 6581
    title: Introduction to Fleet UI
  - startTime: 6667
    title: Creating Cluster Groups (and Troubleshooting)
  - startTime: 6877
    title: Deploying Workloads with Fleet (Add Git Repo)
  - startTime: 7037
    title: Fleet Bundle Deployment
  - startTime: 7060
    title: Troubleshooting Fleet Deployment (ARM Image Issue)
  - startTime: 7203
    title: Git Push & Fleet Auto-Sync
  - startTime: 7309
    title: Verifying Deployment Post-Sync
  - startTime: 7553
    title: Automatic Deployment to New Cluster
  - startTime: 7752
    title: 'Fleet Documentation & Advanced Features (fleet.yaml, Rollout Strategy)'
  - startTime: 7901
    title: Fleet Production Readiness
  - startTime: 7949
    title: 'Q&A: Hooks & Standalone Fleet'
  - startTime: 8114
    title: Summary & Wrap-up
duration: 4706
---

