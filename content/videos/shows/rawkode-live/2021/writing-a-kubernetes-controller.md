---
id: writing-a-kubernetes-controller
slug: writing-a-kubernetes-controller
title: Writing a Kubernetes Controller
description: "In this episode, we're going to explore writing our own Kubernetes controller.\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n03:00 - What is a Kubernetes controller?\n05:30 - What are we going to build?\n15:10 - Question: Controller vs Operator?\n18:20 - Question: Build from scratch or SDKs?\n21:00 - Building the boilerplate for our admission controller\n42:00 - Building a container image\n45:00 - Creating the Kubernetes manifests\n48:00 - Generating the certificates\n1:20:00 - Creating our MutatingWebhook configuration\n1:34:00 - Deploying our admission controller\n1:36:00 - Modifying the Pod spec\n1:49:00 - Resolving the semantic version constraint\n\n\U0001F465 About the Guests\n\nSuhail Patel\n\n   I'm a software engineer focused on designing and operating distributed systems.\nCurrently I work at Monzo \U0001F3E6 as a Platform Engineer. I work with Go, Kubernetes, Envoy Proxy, Etcd, Cassandra and more. I focus on keeping the systems reliable and correct.\nPreviously, I was at Citymapper \U0001F682 helping make Public Transit in cities usable. I worked on integrating real-time departures, multimodal routing, search as well as evolving the backend infrastructure underpinning everything.\n\n\n\U0001F426 https://twitter.com/suhailpatel\n\U0001F9E9 https://github.com/suhailpatel\n\U0001F30F https://suhailpatel.com/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://gitlab.com/rawkode/kubernetes-semantic-image-controller"
publishedAt: 2021-02-10T17:00:00.000Z
technologies:
  - kubernetes
show: rawkode-live
videoId: wm654x7yh3u93du0p8g2vfd3
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 61
    title: Introduction
  - startTime: 180
    title: What is a Kubernetes controller?
  - startTime: 199
    title: What is a Kubernetes Controller?
  - startTime: 269
    title: 'Discussion: Controllers in Kubernetes Core'
  - startTime: 330
    title: What are we going to build?
  - startTime: 336
    title: 'The Problem: Semantic Versioning in Image Tags'
  - startTime: 476
    title: 'Exploring Extension Points: Admission Controllers'
  - startTime: 540
    title: 'Admission Controllers: Webhooks Explained'
  - startTime: 738
    title: 'Webhooks: HTTP Handlers & JSON Patch'
  - startTime: 910
    title: 'Question: Controller vs Operator?'
  - startTime: 917
    title: 'Q&A: Controller vs. Operator'
  - startTime: 1100
    title: 'Question: Build from scratch or SDKs?'
  - startTime: 1103
    title: 'Q&A: Building from Scratch vs. SDKs'
  - startTime: 1248
    title: Building the Basic Go Webhook
  - startTime: 1260
    title: Building the boilerplate for our admission controller
  - startTime: 1503
    title: Processing the Admission Review Request
  - startTime: 1720
    title: Basic Webhook Code Walkthrough & Error Handling
  - startTime: 2520
    title: Building a container image
  - startTime: 2546
    title: 'Preparing for Deployment: Docker & TLS'
  - startTime: 2692
    title: Certificate Requirements
  - startTime: 2700
    title: Creating the Kubernetes manifests
  - startTime: 2880
    title: Generating the certificates
  - startTime: 2897
    title: Generating TLS Certificates with CFSSL
  - startTime: 3137
    title: Creating and Approving the Kubernetes CSR
  - startTime: 3305
    title: Debugging Certificate Approval Problems
  - startTime: 4800
    title: Creating our MutatingWebhook configuration
  - startTime: 4930
    title: Defining the Mutating Webhook Configuration
  - startTime: 5111
    title: 'Webhook Configuration: Rules, Policy, Client Config'
  - startTime: 5400
    title: Deploying the Webhook Application
  - startTime: 5640
    title: Deploying our admission controller
  - startTime: 5697
    title: Testing the Basic Mutation
  - startTime: 5760
    title: Modifying the Pod spec
  - startTime: 5949
    title: Implementing Image Mutation Logic
  - startTime: 6447
    title: Verifying Basic Image Mutation
  - startTime: 6540
    title: Resolving the semantic version constraint
  - startTime: 6579
    title: Adding Semantic Versioning Logic
  - startTime: 6605
    title: Introducing the Semver Library
  - startTime: 6677
    title: Implementing Semver Resolution Logic
  - startTime: 7148
    title: Testing and Debugging Semver Resolution
  - startTime: 7410
    title: Semantic Versioning Mutation Works!
  - startTime: 7435
    title: Next Steps & Conclusion
  - startTime: 7629
    title: Farewell
duration: 7705
---

