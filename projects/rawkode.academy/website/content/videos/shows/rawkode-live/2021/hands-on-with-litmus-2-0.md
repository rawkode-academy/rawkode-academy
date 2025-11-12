---
id: hands-on-with-litmus-2-0
slug: hands-on-with-litmus-2-0
title: Hands-on with Litmus 2.0
description: "In this episode, we take a look at the latest major release of Litmus: 2.0\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n05:25 - What's new in Litmus 2.0?\n15:00 - Demo\n\n\U0001F465 About the Guests\n\nKarthik Satchitanand\n\n  Karthik Satchitanand is one of the maintainers of the CNCF sandbox project LitmusChaos and a Co-Founder at ChaosNative. He is passionate about all things Kubernetes, and is generally interested in DevOps, storage performance/benchmarking & chaos engineering.\n\n\n\U0001F426 https://twitter.com/ksatchit\n\U0001F9E9 https://github.com/ksatchit\n\n\n\n\U0001F528 About the Technologies\n\nLitmus\n\nLitmus is a toolset to do cloud-native chaos engineering. Litmus provides tools to orchestrate chaos on Kubernetes to help SREs find weaknesses in their deployments. SREs use Litmus to run chaos experiments initially in the staging environment and eventually in production to find bugs, vulnerabilities. Fixing the weaknesses leads to increased resilience of the system.\nLitmus takes a cloud-native approach to create, manage and monitor chaos. Chaos is orchestrated using the following Kubernetes Custom Resource Definitions (CRDs):\n- ChaosEngine: A resource to link a Kubernetes application or Kubernetes node to a - ChaosExperiment. ChaosEngine is watched by Litmus' Chaos-Operator which then invokes Chaos-Experiments\n- ChaosExperiment: A resource to group the configuration parameters of a chaos experiment. ChaosExperiment CRs are created by the operator when experiments are invoked by ChaosEngine.\n- ChaosResult: A resource to hold the results of a chaos-experiment. The Chaos-exporter reads the results and exports the metrics into a configured Prometheus server.\n\n\n\U0001F30F https://litmuschaos.io/\n\U0001F426 https://twitter.com/LitmusChaos\n\U0001F9E9 https://github.com/litmuschaos/litmus"
publishedAt: 2021-07-28T17:00:00.000Z
technologies:
  - litmus
show: rawkode-live
videoId: r6seigg9ay2yn6pwr591hbln
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 61
    title: Introduction & Welcome
  - startTime: 143
    title: Introducing Kartik & Litmus Overview
  - startTime: 191
    title: What Litmus is & Chaos Engineering Principles
  - startTime: 266
    title: Preview of Litmus 2.0
  - startTime: 325
    title: What's new in Litmus 2.0?
  - startTime: 400
    title: 'Evolution of Litmus: Kubernetes Native & Early Features'
  - startTime: 466
    title: Community Feedback & New Requirements
  - startTime: 608
    title: The Need for Probes and Steady State Validation
  - startTime: 844
    title: Why Litmus 2.0? (Major Version Upgrade)
  - startTime: 900
    title: Demo
  - startTime: 915
    title: 'Hands-on Demo: Litmus Portal Overview'
  - startTime: 968
    title: Litmus 2.0 Architecture (Portal & Agent Components)
  - startTime: 1280
    title: 'Litmus 2.0 Feature: Chaos Hub (Public & Private)'
  - startTime: 1452
    title: >-
      Litmus 2.0 Feature: Analytics Dashboard (Resilience Score, Application
      Monitoring)
  - startTime: 1655
    title: 'Litmus 2.0 Feature: Teams & Collaboration'
  - startTime: 1708
    title: 'Litmus 2.0 Feature: GitOps Integration'
  - startTime: 1907
    title: 'Litmus 2.0 Feature: Docker Registry Customization'
  - startTime: 1945
    title: 'Litmus 2.0 Feature: Usage Statistics'
  - startTime: 1981
    title: 'Litmus 2.0 Feature: API Documentation'
  - startTime: 2005
    title: 'Q&A: Centralized vs Standalone & Getting Started'
  - startTime: 2354
    title: 'Q&A: Supported Data Sources (Prometheus)'
  - startTime: 2549
    title: How to Contribute to Litmus
  - startTime: 2587
    title: 'Workflow Creation Demo: Bank of Anthos Network Chaos Setup'
  - startTime: 2725
    title: Creating Workflow from Chaos Hub (Selecting Experiments & Tuning)
  - startTime: 2980
    title: Adding Probes for Validation (Initially Skipping)
  - startTime: 3057
    title: Explaining Resilience Score Calculation
  - startTime: 3233
    title: Scheduling Workflows
  - startTime: 3247
    title: Viewing the Workflow YAML
  - startTime: 3317
    title: Executing Bank of Anthos Workflow & Observing Impact
  - startTime: 3539
    title: Viewing Workflow Results & Logs
  - startTime: 3655
    title: Need for Workflows (Chained Failures)
  - startTime: 3682
    title: 'Other Workflow Creation Methods (Cloning, Importing YAML)'
  - startTime: 3728
    title: Git Syncing Workflows
  - startTime: 3778
    title: The Litmus Chaos Center (Centralized Management)
  - startTime: 3829
    title: 'Chaos Against Non-Kubernetes Entities (AWS, GCP, Azure, VMware)'
  - startTime: 4028
    title: EC2 Instance Failure Demo Setup (Weaveworks Sock Shop)
  - startTime: 4076
    title: 'Steady State Hypothesis with Probes (HTTP, Performance Checks)'
  - startTime: 4135
    title: 'Creating EC2 Failure Workflow (Importing YAML, Tuning)'
  - startTime: 4319
    title: Executing EC2 Instance Failure Workflow
  - startTime: 4353
    title: Observing EC2 Impact & Application Metrics
  - startTime: 4604
    title: Recap of Chaos Principles & Litmus 2.0 Capabilities
  - startTime: 5066
    title: 'Future Directions: Security Chaos'
  - startTime: 5090
    title: Community & Contributions in CNCF
  - startTime: 5139
    title: Conclusion & Thank You
duration: 5279
---

