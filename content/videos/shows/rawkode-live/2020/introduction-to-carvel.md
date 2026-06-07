---
id: nkb7uezm4s80fze37vjfqyfb
slug: introduction-to-carvel
title: Introduction to Carvel
description: >-
  Dmitriy Kalinin (VMware), maintainer of Carvel, walks through the suite
  formerly known as k14s: kapp for diff-aware deployments, ytt's structural YAML
  templating in Starlark, kapp-controller for GitOps, plus kbld and imgpkg for
  image and bundle workflows.
whatYouWillLearn:
  - "How Carvel's kapp manages Kubernetes diff-based deployments, annotations, ordering, and error-focused rollout control."
  - "How ytt uses structural YAML and overlays to share reusable templates and customize environment-specific Kubernetes manifests."
  - "How kbld and imgpkg convert image tags to digests and bundle config with images for reproducible, relocatable deployments."
publishedAt: 2020-09-30T17:00:00.000Z
type: live
category: tutorial
technologies:
  - carvel
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 75
    title: Introductions
  - startTime: 79
    title: Introduction
  - startTime: 120
    title: What is Carvel?
  - startTime: 122
    title: What Problem Does Carvel Solve?
  - startTime: 294
    title: Core Carvel Tools Overview
  - startTime: 400
    title: Installing Carvel
  - startTime: 402
    title: Installation
  - startTime: 500
    title: Why did it change name from k14s to Carvel?
  - startTime: 671
    title: Starting with Kapp (Deployment Tool)
  - startTime: 680
    title: Hands on with kapp
  - startTime: 699
    title: Deploying with Kapp
  - startTime: 786
    title: Kapp's Deployment Planning & Applying
  - startTime: 898
    title: Observing Deployment State & Errors
  - startTime: 1131
    title: Kapp Inspect & Resource Management
  - startTime: 1230
    title: Advanced Kapp Features (Annotations & Ordering)
  - startTime: 1500
    title: Introduction to kapp-controller
  - startTime: 1549
    title: Kapp Controller (GitOps Style)
  - startTime: 1786
    title: Introduction to YTT (Templating & Overlaying)
  - startTime: 1800
    title: Hands on with ytt
  - startTime: 1961
    title: 'YTT Basics: Plain YAML & Functions'
  - startTime: 2585
    title: Sharing Logic with YTT Libraries
  - startTime: 3063
    title: YTT Overlays for Customization
  - startTime: 3431
    title: Organizing YTT Files with Directories
  - startTime: 3600
    title: Introduction to kbld
  - startTime: 3628
    title: Introduction to Kbuild (Image Building & Referencing)
  - startTime: 3810
    title: Introduction to imgpkg
  - startTime: 3814
    title: Introduction to ImagePackage (Bundles & Relocation)
  - startTime: 3911
    title: Conclusion & Resources
duration: 4005
guests:
  - cppforlife
resources:
  - title: ytt Playground
    type: url
    url: 'https://carvel.dev/ytt/'
    category: demos
  - title: kapp-controller NGINX Helm example
    type: url
    category: demos
  - title: ytt load documentation
    type: url
    url: 'https://carvel.dev/ytt/docs/latest/lang-ref-load/'
    category: documentation
  - title: KubeCon Carvel talk
    type: url
    category: other
---
