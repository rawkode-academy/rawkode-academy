---
id: p2b72nkxzbj3rgb4v4knvo4y
slug: introduction-to-cortex
title: Introduction to Cortex
description: >-
  Ganesh Vernekar joins to walk through Cortex: building from source, wiring
  Prometheus remote_write, scaling it with Docker Compose and MinIO, the
  single-binary vs microservices architecture, and how it compares to Thanos.
whatYouWillLearn:
  - "Build Cortex from source, run a single binary, and wire Prometheus remote_write for first ingest verification."
  - "Scale a local Cortex deployment with Docker Compose and MinIO, then observe how distributors route metrics to storage."
  - "Compare single-binary and microservices Cortex modes, including ring-based placement, component responsibilities, and scaling tradeoffs."
publishedAt: 2020-11-04T17:00:00.000Z
type: live
category: tutorial
technologies:
  - cortex
  - prometheus
  - grafana
  - thanos
  - docker-compose
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 85
    title: Introductions
  - startTime: 86
    title: Introduction and Welcome
  - startTime: 164
    title: 'Guest Introduction: Ganesh Vernikar'
  - startTime: 225
    title: What problem is Cortex solving?
  - startTime: 438
    title: 'Getting Started: Basic Single Node Setup (Hands-on)'
  - startTime: 440
    title: What was prepared upfront?
  - startTime: 495
    title: Building Cortex from source
  - startTime: 524
    title: Building and Running Cortex Binary
  - startTime: 870
    title: Running Prometheus with Cortex
  - startTime: 935
    title: Configuring Prometheus Remote Write
  - startTime: 1121
    title: Checking Basic Setup (UI & Metrics)
  - startTime: 1421
    title: Verifying Metrics Ingestion
  - startTime: 1514
    title: Horizontally Scaled Demo Setup (Docker Compose)
  - startTime: 1520
    title: Slides and demo - Cortex architecture and scaling
  - startTime: 1856
    title: Scaling Cortex Instances in Demo
  - startTime: 1920
    title: Querying Scaled Cortex via Grafana
  - startTime: 2700
    title: Walking through the demo ourselves
  - startTime: 3240
    title: Cortex architecture
  - startTime: 3244
    title: Cortex Architecture Overview & Components
  - startTime: 3421
    title: 'Scaling Strategies: Single Binary vs. Microservices'
  - startTime: 3692
    title: Storage Backends (Object Storage)
  - startTime: 3740
    title: Caching Strategy
  - startTime: 3900
    title: 'When to Adopt Cortex: Pragmatic Advice'
  - startTime: 3986
    title: Cortex vs. Thanos (Brief Comparison)
  - startTime: 4031
    title: Final Thoughts and Conclusion
duration: 4145
guests:
  - codesome
resources:
  - title: Cortex Getting Started block storage documentation
    type: url
    url: 'https://cortexmetrics.io/docs/getting-started/'
    category: documentation
  - title: Cortex upstream Docker Compose demos
    type: url
    url: 'https://github.com/cortexproject/cortex/tree/master/development'
    category: demos
  - title: Thanos project
    type: url
    url: 'https://github.com/thanos-io/thanos'
    category: code
---
