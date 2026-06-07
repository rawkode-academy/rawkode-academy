---
id: cwauu9hyqp49qiqdn5c2vq4i
slug: introduction-to-open-policy-agent
title: Introduction to Open Policy Agent
description: >-
  Torin Sandall walks through Open Policy Agent end-to-end: Rego basics in the
  OPA Playground, Kubernetes admission policies for label and image-source
  validation using iteration, running OPA locally with bundles and the REPL, and
  writing unit tests for Rego policies.
whatYouWillLearn:
  - "Use OPA as a policy engine to offload decision logic for authorization and Kubernetes admission control."
  - "Write Rego policies with rules, inputs, and iteration patterns for label, resource, and image validation."
  - "Build reproducible policy CI loops using opa run, opa eval, and rego test workflows with local bundles."
publishedAt: 2020-11-19T17:00:00.000Z
type: live
category: tutorial
technologies:
  - opa
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 71
    title: Host Welcome and Sponsor Thanks
  - startTime: 121
    title: Introducing OPA and Guest Torin Sando
  - startTime: 154
    title: What Problem Does OPA Solve?
  - startTime: 240
    title: Introductions
  - startTime: 347
    title: OPA's History and Cloud Native Context
  - startTime: 520
    title: 'OPA''s Core: The Rego Language'
  - startTime: 587
    title: Exploring Rego in the OPA Playground
  - startTime: 600
    title: 'Introduction to Rego, the policy language'
  - startTime: 633
    title: 'Rego Basics: Rules, Input, and Evaluation'
  - startTime: 740
    title: Rego as a Query Language (Datalog based)
  - startTime: 825
    title: Our first Rego policy
  - startTime: 944
    title: Rego Packages and Kubernetes Example (Labels)
  - startTime: 1420
    title: Simple Kubernetes policy - label validation
  - startTime: 1422
    title: 'Kubernetes Example: Image Safety (Iteration with `some`)'
  - startTime: 1860
    title: Complex Kubernetes policy - image source validation
  - startTime: 1980
    title: Deep Dive into Rego Iteration
  - startTime: 2310
    title: OPA Local Development Workflow
  - startTime: 2320
    title: Running Open Policy Agent (OPA) locally with CLI and VSCode
  - startTime: 2354
    title: Running OPA Server Locally with Bundles
  - startTime: 2540
    title: 'OPA CLI: `opa run` and the REPL'
  - startTime: 2614
    title: OPA Data and Input Documents
  - startTime: 2822
    title: 'OPA CLI: `opa eval` for Command Line Execution'
  - startTime: 2933
    title: ConfTest for CI/CD Policy Validation
  - startTime: 3051
    title: Interactive Evaluation and VS Code Extension
  - startTime: 3404
    title: Writing Tests for Rego Policies
  - startTime: 3478
    title: Rego Test Syntax and Running Tests
  - startTime: 3756
    title: Troubleshooting Rego Test Logic
  - startTime: 4376
    title: Conclusion and Thanks
duration: 4450
guests:
  - tsandall
resources:
  - title: OPA Playground
    type: url
    url: 'https://play.openpolicyagent.org/'
    category: demos
  - title: OPA VS Code plugin
    type: url
    url: 'https://marketplace.visualstudio.com/items?itemName=tsandall.opa'
    category: code
  - title: OPA policy testing documentation
    type: url
    url: 'https://www.openpolicyagent.org/docs/policy-testing'
    category: documentation
---
