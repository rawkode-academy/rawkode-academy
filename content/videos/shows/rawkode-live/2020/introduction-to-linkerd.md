---
id: introduction-to-linkerd
slug: introduction-to-linkerd
title: Introduction to Linkerd
description: "Linkerd is a service mesh for Kubernetes. It makes running services easier and safer by giving you runtime debugging, observability, reliability, and security—all without requiring any changes to your code.\n\nLinkerd works by installing a set of ultralight, transparent proxies next to each service instance. These proxies automatically handle all traffic to and from the service. Because they're transparent, these proxies act as highly instrumented out-of-process network stacks, sending telemetry to, and receiving control signals from, the control plane. This design allows Linkerd to measure and manipulate traffic to and from your service without introducing excessive latency.\n\nIn order to be as small, lightweight, and safe as possible, Linkerd's proxies are written in Rust and specialized for Linkerd.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:25 - Introductions\n03:10 - What is a service mesh?\n06:50 - What are we working with?\n07:30 - Installing Linkerd\n12:50 - Linkerd dashboard\n15:40 - Linkerd top\n18:10 - Deploying the demo app\n20:40 - Injecting the Linkerd sidecar\n24:15 - Stat command\n28:20 - Tap command\n31:30 - Fault injection / TrafficSplit / Canary Deploys\n40:50 - Time outs and retries\n49:20 - mTLS\n55:30 - Multi-cluster\n1:09:00 - Closing\n\n\n\U0001F30E Resources\n\nLinkerd - https://linkerd.io\nThomas Rampelberg - https://twitter.com/grampelberg"
publishedAt: 2020-11-04T17:00:00.000Z
technologies:
  - linkerd
show: rawkode-live
videoId: ogx55a28acwbzuwd1d1ic3lm
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 85
    title: Introductions
  - startTime: 86
    title: Introduction & Sponsor Thanks
  - startTime: 141
    title: Introducing Linkerd & Guest (Thomas Rampelberg)
  - startTime: 190
    title: What is a service mesh?
  - startTime: 194
    title: What is a Service Mesh? (Responsibilities & History)
  - startTime: 315
    title: 'Microservices: A Human Problem'
  - startTime: 407
    title: Demo Environment Setup (Pre-provisioned Clusters)
  - startTime: 410
    title: What are we working with?
  - startTime: 450
    title: Installing Linkerd
  - startTime: 456
    title: Linkerd Installation Process (CLI & Edge Version)
  - startTime: 716
    title: Verifying Linkerd Control Plane Installation
  - startTime: 770
    title: Linkerd dashboard
  - startTime: 780
    title: Exploring the Linkerd Web Dashboard
  - startTime: 928
    title: Introduction to Linkerd CLI Tools (Top)
  - startTime: 940
    title: Linkerd top
  - startTime: 1090
    title: Deploying the demo app
  - startTime: 1240
    title: Injecting the Linkerd sidecar
  - startTime: 1455
    title: Stat command
  - startTime: 1700
    title: Tap command
  - startTime: 1890
    title: Fault injection / TrafficSplit / Canary Deploys
  - startTime: 2450
    title: Time outs and retries
  - startTime: 2960
    title: mTLS
  - startTime: 3330
    title: Multi-cluster
  - startTime: 4140
    title: Closing
  - startTime: 4695
    title: Deploying the EmojiVoto Demo Application
  - startTime: 4753
    title: Exploring the Demo App & Finding the Bug
  - startTime: 4841
    title: Injecting Sidecars into the Demo App
  - startTime: 4966
    title: Verifying Sidecar Injection (linkerd check --proxy)
  - startTime: 5060
    title: Viewing Application Metrics (linkerd stat deploy)
  - startTime: 5306
    title: Tapping Live Traffic (linkerd tap)
  - startTime: 5412
    title: Exploring More Linkerd Features
  - startTime: 5518
    title: Setting up Books App for Feature Demos
  - startTime: 5716
    title: Creating a Faulty Backend Service
  - startTime: 5754
    title: Configuring Fault Injection with Traffic Split (SMI)
  - startTime: 6053
    title: 'Retries & Timeouts: Introduction to Service Profiles'
  - startTime: 6102
    title: Understanding Service Profiles (for Metrics & Policy)
  - startTime: 6158
    title: Generating and Applying Service Profiles
  - startTime: 6358
    title: Configuring Retries via Service Profiles
  - startTime: 6518
    title: Configuring Timeouts (Similar Process)
  - startTime: 6560
    title: Exploring MTLS (Mutual TLS)
  - startTime: 6592
    title: MTLS is Enabled by Default in Linkerd
  - startTime: 6663
    title: Validating MTLS (Check & Tap Commands)
  - startTime: 6739
    title: In-depth MTLS Validation (Using tshark Debug Container)
  - startTime: 6925
    title: Attempting Multi-Cluster Setup
  - startTime: 6961
    title: 'Multi-Cluster Setup: Common Trust Anchor'
  - startTime: 7170
    title: Generating Trust Anchor Certificates
  - startTime: 7319
    title: Installing Linkerd for Multi-Cluster
  - startTime: 7435
    title: Linking Clusters (linkerd multicluster link)
  - startTime: 7546
    title: Troubleshooting Multi-Cluster (Load Balancer Issue)
  - startTime: 7749
    title: Multi-Cluster Demo Stopped (Network Limitation)
  - startTime: 7789
    title: Conclusion & Thanks
duration: 4276
---

