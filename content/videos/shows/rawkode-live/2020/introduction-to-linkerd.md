---
id: ogx55a28acwbzuwd1d1ic3lm
slug: introduction-to-linkerd
title: Introduction to Linkerd
description: >-
  Thomas Rampelberg from Buoyant walks through installing Linkerd 2 on
  Kubernetes, exploring the dashboard and CLI (tap, stat, top), running the
  EmojiVoto and Books demos, configuring service profiles for retries and
  timeouts, traffic split fault injection, mTLS, and multi-cluster.
whatYouWillLearn:
  - "Understand how Linkerd 2 installs on Kubernetes and verifies control-plane health with check, dashboard, and CLI validation commands."
  - "Explore service traffic behavior in EmojiVoto and Books demos using linkerd stat, tap, and top to observe requests."
  - "Configure Service Profiles, fault injection, and mTLS defaults in Linkerd while applying retries, timeouts, and traffic splits."
publishedAt: 2020-11-04T17:00:00.000Z
type: live
category: tutorial
technologies:
  - linkerd
  - kubernetes
  - prometheus
  - grafana
show: rawkode-live
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
guests:
  - grampelberg
resources:
  - title: Equinix Metal
    type: url
    url: 'https://deploy.equinix.com/'
    category: other
  - title: EmojiVoto demo application
    type: url
    url: 'https://github.com/BuoyantIO/emojivoto'
    category: demos
  - title: Books app fault injection tutorial demo
    type: url
    url: 'https://linkerd.io/2/tasks/books/'
    category: demos
  - title: Google SRE handbook
    type: url
    url: 'https://sre.google/sre-book/table-of-contents/'
    category: documentation
---
