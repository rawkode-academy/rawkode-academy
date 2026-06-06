---
id: g179fxks66spn3ni7749lzdd
slug: developing-and-building-open-source-with-dagger
title: Developing & Building Open Source with Dagger
description: >-
  Mark Bernstein joins to Daggerize OpenUnison: writing a Dagger pipeline that
  spins up an ephemeral k3s cluster and deploys the OpenUnison Helm charts,
  swapping Podman for Docker along the way to make in-cluster testing work.
publishedAt: 2024-08-15T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - dagger
  - openunison
  - k3s
  - helm
  - docker
  - podman
chapters:
  - startTime: 0
    title: Intro & Apology
  - startTime: 139
    title: Rawkode Live & Daggerizing OpenUnison
  - startTime: 178
    title: 'Guest Intro: Mark Bernstein & OpenUnison Overview'
  - startTime: 244
    title: 'Plan: Deploy OpenUnison with Dagger'
  - startTime: 410
    title: Initializing Dagger & Finding Helm Charts
  - startTime: 740
    title: Dagger Init & Exploring SDKs
  - startTime: 955
    title: Exploring Dagger Helm Module
  - startTime: 1073
    title: Using a Custom Docker Image with Helm
  - startTime: 1422
    title: Provisioning an Ephemeral K3s Cluster
  - startTime: 1929
    title: Debugging K3s Connectivity & Permissions (Podman)
  - startTime: 2898
    title: Switching to Docker & Connecting to K3s
  - startTime: 3447
    title: Successful K3s Cluster Connection
  - startTime: 3656
    title: Configuring OpenUnison Hostnames
  - startTime: 3701
    title: Generating Helm Values with Dagger
  - startTime: 5406
    title: Deploying OpenUnison Helm Charts
  - startTime: 6037
    title: Debugging Helm Chart Test Failure
  - startTime: 6121
    title: The Value of In-Cluster Testing with Dagger
  - startTime: 6328
    title: Refactoring Helm Deployment Logic
  - startTime: 6684
    title: Conclusion & Future Work
  - startTime: 6791
    title: Outro
duration: 6936
guests:
  - mlbiam
resources:
  - title: OpenUnison Helm Charts
    type: url
    url: 'https://github.com/OpenUnison/helm-charts'
    category: code
  - title: 'Kubernetes: An Enterprise Guide'
    type: url
    category: other
  - title: Hurl
    type: url
    url: 'https://hurl.dev'
    category: other
  - title: k3s Dagger Module (marcosnils)
    type: url
    url: 'https://daggerverse.dev/mod/github.com/marcosnils/daggerverse/k3s'
    category: code
---

