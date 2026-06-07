---
id: r6seigg9ay2yn6pwr591hbln
slug: hands-on-with-litmus-2-0
title: Hands-on with Litmus 2.0
description: >-
  Litmus maintainer Karthik Satchitanand previews Litmus 2.0: the new
  ChaosCenter portal, public and private ChaosHubs, resilience scoring, GitOps
  sync, and probes. Demos chain chaos workflows against Bank of Anthos on
  Kubernetes and EC2 failure against Sock Shop.
whatYouWillLearn:
  - "Show how probes validate steady-state hypotheses before faults are injected."
  - "Build chaos workflows from the public or private Chaos Hub."
  - "Track resilience scores from GitOps synced runs across repeated experiments."
publishedAt: 2021-07-28T17:00:00.000Z
type: live
category: tutorial
technologies:
  - litmus
  - kubernetes
  - argo
  - prometheus
  - grafana
show: rawkode-live
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
guests:
  - ksatchit
resources:
  - title: Litmus documentation
    type: url
    url: 'https://docs.litmuschaos.io/'
    category: documentation
  - title: Bank of Anthos demo application
    type: url
    url: 'https://github.com/GoogleCloudPlatform/bank-of-anthos'
    category: demos
  - title: Weaveworks Sock Shop microservices application
    type: url
    url: 'https://github.com/microservices-demo/microservices-demo'
    category: demos
  - title: Principles of Chaos
    type: url
    url: 'https://principlesofchaos.org/'
    category: documentation
---
