---
id: fkojb4nty2dmx3byhpltqwnn
slug: hands-on-introduction-to-litestream
title: Hands-on Introduction to Litestream
description: >-
  Ben Johnson walks through Litestream, his streaming replication tool for
  SQLite. We cover how it tails the WAL, ships segments to S3 or Azure, and
  restores point-in-time copies, then install it and replicate a live database.
publishedAt: 2021-06-22T17:00:00.000Z
type: live
category: tutorial
technologies:
  - litestream
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 90
    title: Introductions
  - startTime: 94
    title: Introduction to Litestream
  - startTime: 113
    title: 'Housekeeping & Community Info (Discord, Subscribe)'
  - startTime: 154
    title: 'Meet Ben Johnson, Creator of Litestream'
  - startTime: 165
    title: Ben's Background and Motivation for Litestream
  - startTime: 240
    title: 'Discussion: Working with Databases'
  - startTime: 315
    title: Why Choose SQLite?
  - startTime: 380
    title: SQLite in Production Use Cases
  - startTime: 468
    title: What Problem Does Litestream Solve?
  - startTime: 576
    title: 'How Litestream Works: SQLite Internals (B-Trees, Pages)'
  - startTime: 585
    title: 'Slides: SQLite Streaming Replication with Litestream'
  - startTime: 677
    title: 'How Litestream Works: WAL Mode & Checkpointing'
  - startTime: 767
    title: 'How Litestream Works: Unrolling the WAL & Replication'
  - startTime: 862
    title: Analogy to Event Sourcing / Kafka
  - startTime: 895
    title: Replication Retention Policy and Costs
  - startTime: 973
    title: Supported S3 Compatible Storage
  - startTime: 998
    title: 'Q&A: WAL Unrolling & Recovery Time'
  - startTime: 1115
    title: 'Hands-on: Setting up a Local S3 Target (MinIO)'
  - startTime: 1256
    title: 'Hands-on: Installing Litestream'
  - startTime: 1448
    title: 'Hands-on: Creating a Sample SQLite Database'
  - startTime: 1500
    title: Creating a SQLite Database
  - startTime: 1720
    title: Replicating SQLite with Litestream
  - startTime: 1732
    title: 'Hands-on: Running Litestream Replicate'
  - startTime: 2044
    title: Checking Replication Status (`litestream generations`)
  - startTime: 2070
    title: Litestream Subcommands
  - startTime: 2270
    title: Sync Interval Configuration
  - startTime: 2353
    title: SQLite WAL Mode Auto-Enablement
  - startTime: 2435
    title: Using Litestream with Existing Applications
  - startTime: 2502
    title: 'Q&A: Litestream with K3s (Kubernetes with SQLite)'
  - startTime: 2631
    title: 'Litestream Subcommands Overview (`snapshots`, `wal`, `databases`)'
  - startTime: 2670
    title: Restoring SQLite with Litestream
  - startTime: 2672
    title: 'Hands-on: Restoring the Database (`litestream restore`)'
  - startTime: 2889
    title: Litestream's Focus on Simplicity
  - startTime: 2926
    title: Summary of Benefits and Production Use Cases
  - startTime: 3000
    title: Summary
  - startTime: 3013
    title: 'Future Possibilities (Read Replicas, Edge Databases, WASM)'
  - startTime: 3131
    title: 'Community & Getting Help (Slack, GitHub, Office Hours)'
  - startTime: 3161
    title: Conclusion and Wrap Up
duration: 3297
guests:
  - ben-johnson
resources:
  - title: Litestream Getting Started guide
    type: url
    url: 'https://litestream.io/getting-started/'
    category: documentation
  - title: Litestream Tips and Caveats section
    type: url
    url: 'https://litestream.io/tips/'
    category: documentation
---

