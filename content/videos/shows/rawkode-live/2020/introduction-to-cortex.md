---
id: introduction-to-cortex
slug: introduction-to-cortex
title: Introduction to Cortex
description: "Cortex: horizontally scalable, highly available, multi-tenant, long term storage for Prometheus.\n\nCortex provides horizontally scalable, highly available, multi-tenant, long term storage for Prometheus.\n\n    Horizontally scalable: Cortex can run across multiple machines in a cluster, exceeding the throughput and storage of a single machine. This enables you to send the metrics from multiple Prometheus servers to a single Cortex cluster and run \"globally aggregated\" queries across all data in a single place.\n    Highly available: When run in a cluster, Cortex can replicate data between machines. This allows you to survive machine failure without gaps in your graphs.\n    Multi-tenant: Cortex can isolate data and queries from multiple different independent Prometheus sources in a single cluster, allowing untrusted parties to share the same cluster.\n    Long term storage: Cortex supports Amazon DynamoDB, Google Bigtable, Cassandra, S3, GCS and Microsoft Azure for long term storage of metric data. This allows you to durably store data for longer than the lifetime of any single machine, and use this data for long term capacity planning.\n\nCortex is a CNCF incubation project used in several production systems including Weave Cloud and Grafana Cloud. Cortex is primarily used as a remote write destination for Prometheus, with a Prometheus-compatible query API.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:25 - Introductions\n03:45 - What problem is Cortex solving?\n07:20 - What was prepared upfront?\n08:15 - Building Cortex from source\n14:30 - Running Prometheus with Cortex\n25:20 - Slides and demo - Cortex architecture and scaling\n45:00 - Walking through the demo ourselves\n54:00 - Cortex architecture\n\n\U0001F30E Resources\n\nGanesh Vernekar - https://twitter.com/_codesome\nCortex - https://cortex.io"
publishedAt: 2020-11-04T17:00:00.000Z
technologies:
  - cortex
show: rawkode-live
videoId: p2b72nkxzbj3rgb4v4knvo4y
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
---

