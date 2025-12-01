---
id: introduction-to-open-policy-agent
slug: introduction-to-open-policy-agent
title: Introduction to Open Policy Agent
description: "Special Guest: Torin Sandall (https://twitter.com/sometorin)\n\n\nTorin Sandall is VP of Open Source at Styra and a co-creator of the Open Policy Agent (OPA) project.\n\nThe Open Policy Agent (OPA, pronounced “oh-pa”) is an open source, general-purpose policy engine that unifies policy enforcement across the stack. OPA provides a high-level declarative language that let’s you specify policy as code and simple APIs to offload policy decision-making from your software. You can use OPA to enforce policies in microservices, Kubernetes, CI/CD pipelines, API gateways, and more.\n\nOPA decouples policy decision-making from policy enforcement. When your software needs to make policy decisions it queries OPA and supplies structured data (e.g., JSON) as input. OPA accepts arbitrary structured data as input.\n\nOPA generates policy decisions by evaluating the query input and against policies and data. OPA and Rego are domain-agnostic so you can describe almost any kind of invariant in your policies.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n04:00 - Introductions\n10:00 - Introduction to Rego, the policy language\n13:45 - Our first Rego policy\n23:40 - Simple Kubernetes policy - label validation\n31:00 - Complex Kubernetes policy - image source validation\n38:40 - Running Open Policy Agent (OPA) locally with CLI and VSCode\n\n\n\U0001F30E Resources\n\nTorin Sandall - https://twitter.com/sometorin\nOpen Policy Agent - https://www.openpolicyagent.org/"
publishedAt: 2020-11-19T17:00:00.000Z
technologies:
  - open-policy-agent
show: rawkode-live
videoId: cwauu9hyqp49qiqdn5c2vq4i
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
---

