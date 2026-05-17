---
id: a2fq3imoh0w5zz0vx1p9czm4
slug: introduction-to-containerd
title: Introduction to containerd
description: >-
  In this episode, joined by Phil Estes (@estes), maintainer for the containerd
  project; we discuss the history and creation of containerd, as well as some
  best practices for using and operating containerd.
publishedAt: 2020-09-22T17:00:00.000Z
type: live
category: tutorial
technologies:
  - containerd
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
  - phil-estes
resources:
  - title: stargz snapshotter KubeCon talk
    category: other
    evidence_quote: >-
      There's a talk from KubeCon a few weeks ago on the star g z snapshot,
      which does lazy image pull and anyway, it can do major speed up in
      container startup time.
    confidence: medium
  - title: containerd issue 4531
    category: other
    evidence_quote: >-
      I just found an issue from seventeen days ago, containerd issue four five
      three one, if people wanna go look it up.
    confidence: high
  - title: Kata Containers
    category: code
    evidence_quote: >-
      This is where you see Cata containers or Firecracker or gVisor or on my on
      Windows, the run HCS tool or or shim that Microsoft has built
    confidence: medium
---

