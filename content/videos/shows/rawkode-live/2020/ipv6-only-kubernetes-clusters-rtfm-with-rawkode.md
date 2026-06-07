---
id: qzf07xf4d395p3bm5ugkqxp0
slug: ipv6-only-kubernetes-clusters-rtfm-with-rawkode
title: IPv6 ONLY Kubernetes Clusters (RTFM with Rawkode)
description: >-
  Arian van Putten walks through building an IPv6-only Kubernetes cluster on
  Packet bare metal: provisioning nodes with Pulumi and TypeScript,
  bootstrapping with kubeadm, installing Calico CNI, and announcing pod and
  service IPv6 addresses to the upstream router via BGP.
whatYouWillLearn:
  - "Use Pulumi and TypeScript to provision IPv6-enabled Packet servers and configure Kubernetes node networking prerequisites."
  - "Understand how kubeadm initializes an IPv6-only cluster with service and pod subnets plus DNS settings."
  - "Apply Calico CNI and BGP route announcements so pods and services receive reachable external IPv6 addresses."
publishedAt: 2020-09-08T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - pulumi
  - docker
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 90
    title: Introductions
  - startTime: 280
    title: Why are we deploying an IPv6 ONLY Kubernetes cluster?
  - startTime: 580
    title: Is this secure?!
  - startTime: 710
    title: Tutorial begins
  - startTime: 835
    title: Creating our servers with Pulumi and TypeScript
  - startTime: 1800
    title: Refactoring server provisioning with TypeScript (Why I love Pulumi)
  - startTime: 2040
    title: Installing Kubernetes with kubeadm
  - startTime: 2970
    title: Installing CNI Calico
  - startTime: 3570
    title: Deploying nginx
  - startTime: 3600
    title: Announcing Kubernetes pod IPv6 addresses with BGP
  - startTime: 4276
    title: Announcing Kubernetes service IPv6 addresses with BGP
duration: 6790
guests:
  - arianvp
resources:
  - title: Calico over IP Fabrics
    type: url
    url: >-
      https://docs.tigera.io/calico/latest/reference/architecture/design/l3-interconnect-fabric
    category: documentation
---
