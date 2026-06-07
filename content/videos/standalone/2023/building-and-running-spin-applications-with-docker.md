---
id: fq72twya4m9ymyey6u0ut3qo
slug: building-and-running-spin-applications-with-docker
title: Building & Running Spin Applications with Docker
description: >-
  Spin 1.0 ships Spin apps as OCI artifacts. Push to GHCR with spin registry
  push, run with spin up -f, then build a Dockerfile so docker run and docker
  compose work, and sign the image with cosign keyless.
whatYouWillLearn:
  - "Package Spin applications as OCI artifacts and push them to GHCR."
  - "Run registry images locally with spin up -f from any directory."
  - "Build a Dockerfile for Spin, then use Docker Compose and cosign."
publishedAt: 2023-04-27T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - spin
  - docker
  - docker-compose
  - sigstore
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 27
    title: Spin 1.0 and OCI Registry Support
  - startTime: 50
    title: Basic Spin Application Demo
  - startTime: 93
    title: Building and Pushing OCI Artifacts (V1)
  - startTime: 134
    title: Updating and Repushing V2 Artifact
  - startTime: 172
    title: Running Spin Apps from OCI Registry
  - startTime: 226
    title: Spin Applications with Docker Integration
  - startTime: 306
    title: Spin with Docker Compose
  - startTime: 340
    title: Signing Spin Artifacts with Cosign
  - startTime: 458
    title: Conclusion
duration: 488
guests: []
resources:
  - title: 'Docker documentation: Building and running Spin applications'
    type: url
    category: documentation
    url: 'https://docs.docker.com/desktop/wasm/'
  - title: Spin registry push and OCI artifacts
    type: url
    category: documentation
    url: 'https://spinframework.dev/v3/registry-tutorial'
  - title: Sigstore Cosign keyless signing
    type: url
    category: documentation
    url: 'https://docs.sigstore.dev/cosign/signing/signing_with_blobs/'
---
