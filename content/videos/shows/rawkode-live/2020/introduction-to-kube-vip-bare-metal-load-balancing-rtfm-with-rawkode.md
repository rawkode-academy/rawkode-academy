---
id: xga6a9uvs6yot1u103nmv77z
slug: introduction-to-kube-vip-bare-metal-load-balancing-rtfm-with-rawkode
title: 'Introduction to kube-vip: Bare Metal Load Balancing (RTFM with Rawkode)'
description: >-
  Dan Finneran walks through kube-vip, his bare-metal load balancer for
  Kubernetes. We cover Plunder for provisioning, then demo a control plane VIP
  via Raft leader election and Service type LoadBalancer announced over BGP on
  Equinix Metal.
publishedAt: 2020-09-03T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kube-vip
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 85
    title: Introductions
  - startTime: 280
    title: Introduction to Plunder (Bare metal provisioning tool)
  - startTime: 360
    title: Dan takes down a hotel network
  - startTime: 480
    title: What makes bare metal Kubernetes different from managed services?
  - startTime: 580
    title: What are we going to demo today?
  - startTime: 720
    title: VIP for Kubernetes Control Plane High Availability (HA)
  - startTime: 2100
    title: >-
      Load balancing Kubernetes services using a LoadBalancer service (DHCP and
      BGP)
duration: 3078
guests:
  - thebsdbox
resources:
  - title: kube-vip documentation
    type: url
    url: 'https://kube-vip.io/docs/'
    category: documentation
  - title: kube-vip source code
    type: url
    url: 'https://github.com/kube-vip/kube-vip'
    category: code
---

