---
id: klzxhw3ow8qzrua89xr91717
slug: using-guidepad-io-to-primitives-to-simplify-future-facing-problems
title: Using Guidepad.io to Primitives to Simplify Future Facing Problems
description: >-
  Terraform's resource model only understands CRUD and polls for drift. Using
  Guidepad primitives (environments, control planes, state machines,
  requirements), we build an event-driven S3 provider in ~100 lines of Python
  that reconciles from CloudTrail events.
publishedAt: 2024-01-29T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - guidepad
  - terraform
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 41
    title: The Problem with Traditional IaC (Terraform Model)
  - startTime: 99
    title: The Problem
  - startTime: 202
    title: 'The Future of IaC: Real-time & Event-Driven Reconciliation'
  - startTime: 259
    title: Terraform Way
  - startTime: 260
    title: What is Guidepad? Platform Overview
  - startTime: 316
    title: Guidepad Environments and Control Planes
  - startTime: 374
    title: Terraform Control Plane in Guidepad (Briefly)
  - startTime: 424
    title: Guidepad State Management
  - startTime: 485
    title: Guidepad Way
  - startTime: 488
    title: Building the Event-Driven Solution with Guidepad Primitives
  - startTime: 514
    title: Deep Dive into the Event-Driven S3 Service Code (Python)
  - startTime: 601
    title: Advantages of Custom Code (Handling Complex Scenarios)
  - startTime: 700
    title: Guidepad State Machines for Resource Management
  - startTime: 745
    title: '**Demonstration:** Event-Driven S3 Bucket Reconciliation'
  - startTime: 833
    title: 'How it Works: CloudTrail Requirements & Event Detection'
  - startTime: 896
    title: Guidepad User Interface Overview
  - startTime: 1029
    title: Conclusion
  - startTime: 1031
    title: 'Recap: Guidepad Primitives Used'
  - startTime: 1135
    title: Broader Applications & Potential
  - startTime: 1169
    title: Conclusion & Final Thoughts
duration: 1193
guests: []
resources:
  - title: S3 Provider Service Demo
    type: url
    category: code
  - title: CloudTrail Requirement Class
    type: url
    category: code
  - title: Terraform Control Plane Implementation
    type: url
    category: code
---

