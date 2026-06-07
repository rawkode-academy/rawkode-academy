---
id: tq4z0nov4d8znm2y0pubx56b
slug: kubernetes-cluster-api-for-equinix-metal-formely-packet
title: Kubernetes Cluster API for Equinix Metal (Formely Packet)
description: >-
  Jason DeTiberus joins to walk through declaratively defining Kubernetes
  clusters with Cluster API, installing the Packet infrastructure provider,
  generating a workload cluster config with clusterctl, and bootstrapping nodes
  via kubeadm on Packet bare metal.
whatYouWillLearn:
  - "Use Cluster API to define Kubernetes cluster lifecycle declaratively with separate management and workload responsibilities."
  - "Initialize a Cluster API management cluster with clusterctl and provider plugins, including version and dependency checks."
  - "Generate Packet provider cluster manifests, apply them, then fetch kubeconfig and add-ons to bring CNI and scaling workflow online."
publishedAt: 2020-08-26T15:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cluster-api
show: rawkode-live
chapters:
  - startTime: 0
    title: Starting Soon Screen (Exciting!)
  - startTime: 145
    title: Introductions
  - startTime: 180
    title: What is Cluster API?
  - startTime: 290
    title: Is the world moving from one large cluster to many small clusters?
  - startTime: 480
    title: Can we use GitOps for durable management clusters?
  - startTime: 540
    title: Is Cluster API the best way to deploy a new cluster?
  - startTime: 620
    title: Why does Cluster API exist?
  - startTime: 740
    title: "Do we call it CAPI? \U0001F923"
  - startTime: 780
    title: >-
      Checking dependencies (clusterctl, Docker and kubectl) and version
      constraints
  - startTime: 900
    title: Preparing our management cluster with the Packet provider
  - startTime: 1190
    title: Generating a config for our first Packet Kubernetes cluster
  - startTime: 1670
    title: Creating the Kubernetes cluster
duration: 4110
guests:
  - detiber
resources:
  - title: Cluster API Book Quick Start
    type: url
    url: 'https://cluster-api.sigs.k8s.io/user/quick-start.html'
    category: documentation
  - title: Cluster API Provider Packet repository
    type: url
    url: 'https://github.com/kubernetes-sigs/cluster-api-provider-packet'
    category: code
  - title: Kubernetes SIGs Image Builder
    type: url
    url: 'https://github.com/kubernetes-sigs/image-builder'
    category: code
  - title: Cluster Addons project
    type: url
    url: 'https://github.com/kubernetes-sigs/cluster-addons'
    category: code
  - title: Cluster Autoscaler
    type: url
    url: 'https://github.com/kubernetes/autoscaler'
    category: code
---
