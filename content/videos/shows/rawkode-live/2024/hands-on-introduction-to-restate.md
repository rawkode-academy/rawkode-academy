---
id: i5nzkd2k3rgebh7w1o233lgn
slug: hands-on-introduction-to-restate
title: Hands-on Introduction to Restate
description: >-
  Jack Kleeman walks through Restate, a single-binary durable execution engine
  written in Rust. We cover context.run, keyed state, suspending and resuming
  workflows, context.promise, and live code a TypeScript write handler.
whatYouWillLearn:
  - "Model cross-service waits with durable promises and shared awakable IDs."
  - "Make CRUD handlers idempotent by treating validation and duplicate writes as terminal errors."
  - "Deploy Restate as a distributed runtime with high-availability failover across nodes."
publishedAt: 2024-09-11T17:00:00.000Z
type: live
category: tutorial
technologies:
  - restate
  - rust
show: rawkode-live
chapters:
  - startTime: 153
    title: Introduction to Rawkode Academy and Guest
  - startTime: 178
    title: Introducing Restate
  - startTime: 204
    title: Guest Introduction and Motivation
  - startTime: 375
    title: The Challenges of Distributed Systems
  - startTime: 550
    title: 'Restate''s Core Concept: Durable/Suspendable Functions'
  - startTime: 754
    title: Simplifying Code with Restate's API
  - startTime: 849
    title: Restate's Architecture and Position
  - startTime: 904
    title: Restate's Rust Core and Language SDKs
  - startTime: 950
    title: 'Operating Restate: Single Binary & Performance'
  - startTime: 4753
    title: Preparing for Hands-on Demo
  - startTime: 4804
    title: Restate v1.0 Release and Stability
  - startTime: 4888
    title: 'Exploring Core Concepts: `context.run` & State'
  - startTime: 6173
    title: 'Durability Demo: Suspending and Resuming'
  - startTime: 6598
    title: 'Real-World Use Case: User Registration Workflow'
  - startTime: 6956
    title: Implementing the Workflow with `context.promise`
  - startTime: 7218
    title: Host's Architecture and the Distributed Write Problem
  - startTime: 7736
    title: 'Live Coding: Building a Restate Write Handler'
  - startTime: 8471
    title: Idempotency and Generic Handlers for CRUD
  - startTime: 8873
    title: Restate Roadmap and Future
  - startTime: 8931
    title: Conclusion and Planning Part Two
duration: 5470
guests:
  - jackkleeman
resources:
  - type: url
    title: Restate
    url: 'https://restate.dev/'
    category: other
  - type: url
    title: Restate Documentation
    url: 'https://docs.restate.dev/'
    category: documentation
  - type: url
    title: Restate Examples
    url: 'https://github.com/restatedev/examples'
    category: code
---
