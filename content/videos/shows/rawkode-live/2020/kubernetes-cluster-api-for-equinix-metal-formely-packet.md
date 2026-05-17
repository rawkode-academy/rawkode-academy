---
id: tq4z0nov4d8znm2y0pubx56b
slug: kubernetes-cluster-api-for-equinix-metal-formely-packet
title: Kubernetes Cluster API for Equinix Metal (Formely Packet)
description: >-
  In this episode, joined by my colleague Jason DeTiberus, we explore using the
  Kubernetes Cluster API to deploy new Kubernetes clusters on Packet.
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
  - jason-detiberus
resources:
  - title: Cluster API Book Quick Start
    category: documentation
    evidence_quote: So let's go straight to the quick start.
    confidence: high
  - title: Cluster API Provider Packet repository
    category: code
    evidence_quote: 'It will reach out to the cluster API provider packet repo,'
    confidence: medium
  - title: Kubernetes SIGs Image Builder
    category: code
    evidence_quote: 'there''s a Kubernetes SIGs project image builder,'
    confidence: high
  - title: Cluster Addons project
    category: code
    evidence_quote: how can we align with projects like the cluster add ons project
    confidence: medium
  - title: Cluster Autoscaler
    category: code
    evidence_quote: >-
      You can throw in things like the cluster autoscaler into the mix and start
      automating scaling of these clusters as well.
    confidence: medium
---

