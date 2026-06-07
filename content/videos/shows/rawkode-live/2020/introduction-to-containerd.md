---
id: a2fq3imoh0w5zz0vx1p9czm4
slug: introduction-to-containerd
title: Introduction to containerd
description: >-
  Phil Estes, containerd maintainer, walks through how containerd was extracted
  from Docker, its gRPC service architecture, snapshotters and CRI integration
  versus CRI-O, plus hands-on debugging with ctr and microk8s.
whatYouWillLearn:
  - "Trace containerd's origin from Docker into a standalone runtime layer used by Kubernetes and OCI ecosystems."
  - "Explore containerd's gRPC API, pluggable services, namespaces, and CRI or build integrations with practical examples."
  - "Practice CTR usage in microk8s by pulling images, creating namespaces, running containers, and debugging failures with deep logs."
publishedAt: 2020-09-22T17:00:00.000Z
type: live
category: tutorial
technologies:
  - containerd
  - docker
  - kubernetes
  - crio
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 95
    title: Introductions
  - startTime: 140
    title: How do we pronounce containerd?
  - startTime: 210
    title: How did containerd come to exist?
  - startTime: 540
    title: What projects are using containerd?
  - startTime: 810
    title: Looking at the containerd architecture?
  - startTime: 1800
    title: Is containerd competing with cri-o?
  - startTime: 2052
    title: What are some best practices for running containerd with systems?
  - startTime: 2240
    title: Getting hands on with containerd via microk8s
  - startTime: 2370
    title: Using car to manage images and containers
  - startTime: 2870
    title: 'Shit, it’s not working. Lets install Docker'
  - startTime: 3300
    title: How do I debug containerd issues?
  - startTime: 3540
    title: Are there plans to improve the containerd documentation?
  - startTime: 3780
    title: Can I proxy / pull through cache other registries with containerd?
duration: 4025
guests:
  - estesp
resources:
  - title: stargz snapshotter KubeCon talk
    type: url
    category: other
  - title: containerd issue 4531
    type: url
    url: 'https://github.com/containerd/containerd/issues/4531'
    category: code
  - title: Kata Containers
    type: url
    url: 'https://katacontainers.io/'
    category: code
---
