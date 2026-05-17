---
id: nf0c2zf2w370qg9s6d74ywjd
slug: hands-on-introduction-to-kaniko
title: Hands-on Introduction to Kaniko
description: >-
  Tejal Desai (Kaniko maintainer at Google) walks through building container
  images inside Kubernetes without Docker-in-Docker, covering the executor pod,
  registry secrets, layer caching, snapshot modes, and Tekton/GitLab CI.
publishedAt: 2021-04-23T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kaniko
  - kubernetes
  - tektoncd
  - gitlab
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 93
    title: Introducing the Guest & Tejal's Background
  - startTime: 173
    title: What is Kaniko & Why Use It? (Addressing Docker-in-Docker Security)
  - startTime: 175
    title: What is Kaniko?
  - startTime: 327
    title: How Kaniko Works (Internal Mechanics & File System Snapshotting)
  - startTime: 491
    title: Starting the Hands-on Demonstration
  - startTime: 500
    title: Building an Image
  - startTime: 526
    title: Setting up the Build Environment (Required YAML files)
  - startTime: 672
    title: Why Kaniko Must Run in a Container
  - startTime: 724
    title: Troubleshooting Initial Setup (Volume Issues)
  - startTime: 890
    title: Setting up Docker Registry Secret
  - startTime: 990
    title: Applying Kubernetes Manifests
  - startTime: 1050
    title: Debugging Volume Claim Issues
  - startTime: 1134
    title: Watching Build Logs & First Build Attempt
  - startTime: 1224
    title: Debugging Registry Secret Configuration
  - startTime: 1344
    title: Correcting Pod Specification (Destination Path)
  - startTime: 1377
    title: Second Build Attempt
  - startTime: 1445
    title: Running the Built Image (Troubleshooting Output)
  - startTime: 1492
    title: Updating Dockerfile for Output
  - startTime: 1576
    title: Debugging Output Display
  - startTime: 1632
    title: Successful Build & Image Run
  - startTime: 1650
    title: Build Caching
  - startTime: 1662
    title: Introduction to Kaniko Caching
  - startTime: 1690
    title: How Caching Works & Cache Configuration
  - startTime: 1840
    title: Exploring Cache Flags & Parameters
  - startTime: 1906
    title: Enabling Caching with a More Complex Dockerfile (App Install)
  - startTime: 1974
    title: Troubleshooting Cache Push Issue
  - startTime: 1990
    title: Discussion of Cross-Platform Build Support
  - startTime: 2116
    title: Correcting Cache Repository Parameter
  - startTime: 2204
    title: Second Build with Caching (Demonstrating Speed)
  - startTime: 2375
    title: Understanding Cache Keying
  - startTime: 2400
    title: Image Snapshotting
  - startTime: 2441
    title: 'Snapshotting Modes for Performance (Full, ReDo, Mtime)'
  - startTime: 2613
    title: Reproducible Builds Feature
  - startTime: 2693
    title: Kaniko Image Types & Cache Warmer
  - startTime: 2838
    title: Scaling Kaniko Builds in CI
  - startTime: 2872
    title: 'Integration with CI/CD Platforms (Tekton, GCB, GitLab)'
  - startTime: 2957
    title: 'Alternative Build Contexts (Git, Cloud Storage)'
  - startTime: 3066
    title: Summary & Community Involvement
  - startTime: 3101
    title: Conclusion & Farewell
duration: 3200
guests:
  - tejal-desai
  - google-cloud-platform
resources:
  - title: Kaniko Getting Started tutorial
    type: url
    category: documentation
    url: 'https://github.com/GoogleContainerTools/kaniko#kaniko-build-contexts'
  - title: Kaniko build context documentation
    type: url
    category: documentation
    url: 'https://github.com/GoogleContainerTools/kaniko#kaniko-build-contexts'
  - title: GitLab tutorial dedicated to Kaniko
    type: url
    category: documentation
    url: 'https://docs.gitlab.com/ci/docker/using_kaniko/'
---

