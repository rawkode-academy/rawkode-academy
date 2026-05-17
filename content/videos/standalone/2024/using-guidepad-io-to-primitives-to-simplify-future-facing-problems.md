---
id: klzxhw3ow8qzrua89xr91717
slug: using-guidepad-io-to-primitives-to-simplify-future-facing-problems
title: Using Guidepad.io to Primitives to Simplify Future Facing Problems
description: >-
  Terraform has been amazing for Infrastructure as Code; but can what got is
  here, get us to where we need to be in the future? I don't think so.
publishedAt: 2024-01-29T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - guidepad
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
    category: code
    evidence_quote: 'It is called s three provider, and it is 105 lines long.'
    confidence: high
  - title: CloudTrail Requirement Class
    category: code
    evidence_quote: >-
      Inside of our plugin, we have requirements dot py. In this, we define a
      new class which extend requirement called CloudTrail requirement.
    confidence: high
  - title: Terraform Control Plane Implementation
    category: code
    evidence_quote: >-
      If we pop open Terraform, we will see the code. Now all this does is give
      Guidepad enough information to tell it how to execute Terraform programs.
    confidence: medium
---

