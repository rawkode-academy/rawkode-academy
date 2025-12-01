---
id: hands-on-introduction-to-kluctl
slug: hands-on-introduction-to-kluctl
title: Hands-on Introduction to kluctl
description: >-
  Kluctl is the missing glue that puts together your (and any third-party)
  deployments into one large declarative Kubernetes deployment, while making it
  fully manageable (deploy, diff, prune, delete, ...) via one unified command
  line interface.


  Kluctl tries to be as flexible as possible, while remaining as simple as
  possible. It reuses established tools (e.g. Kustomize and Helm), making it
  possible to re-use a large set of available third-party deployments.


  Kluctl is centered around "targets", which can be a cluster or a specific
  environment (e.g. test, dev, prod, ...) on one or multiple clusters. Targets
  can be deployed, diffed, pruned, deleted, and so on. The idea is to have the
  same set of operations for every target, no matter how simple or complex the
  deployment and/or target is.



  - https://kluctl.io/

  - https://github.com/kluctl/kluctl
publishedAt: 2022-10-20T17:00:00.000Z
technologies:
  - kluctl
show: rawkode-live
videoId: nif2kkr7kig9n82jxsjyd2ds
chapters:
  - startTime: 161
    title: Introduction
  - startTime: 181
    title: 'Guest Introduction (Alexander Block, creator of Kluctl)'
  - startTime: 273
    title: What is Kluctl? (TLDR and History)
  - startTime: 331
    title: Transition to Presentation
  - startTime: 350
    title: 'Presentation: Agenda'
  - startTime: 381
    title: Why Another Deployment Tool? (Problem Statement)
  - startTime: 416
    title: >-
      Key Deployment Requirements (Infrastructure as Code, Automation,
      Reproducibility)
  - startTime: 482
    title: 'Key Requirement: Multiple Environments & Clusters'
  - startTime: 536
    title: 'Key Requirement: Secrets Management'
  - startTime: 569
    title: 'Key Requirement: Deployment Safety (No accidental deployments)'
  - startTime: 3604
    title: Introducing Kluctl (How it Solves Problems)
  - startTime: 3605
    title: Deploying to Multiple Targets (Dev vs Prod)
  - startTime: 3608
    title: Deployment Labels Requirement (State Management)
  - startTime: 3610
    title: Dynamic Namespaces with Templating
  - startTime: 3612
    title: Deploying Resources with Kustomize (Namespace example)
  - startTime: 3614
    title: 'Key Requirement: Day 2 Operations (Current State, Diff)'
  - startTime: 3616
    title: Verify NGINX Deployment
  - startTime: 3618
    title: Creating a Basic Kluctl Project (`deployment.yaml`)
  - startTime: 3620
    title: Defining Deployment Targets
  - startTime: 3623
    title: Summary of Problems and Need for Glue Code
  - startTime: 3629
    title: 'Key Requirement: Configuration Management (Templating)'
  - startTime: 3630
    title: Deployment Ordering / Barriers
  - startTime: 3634
    title: Kluctl Core Concepts & Features
  - startTime: 3636
    title: Discussing Statelessness
  - startTime: 3637
    title: Layering and Including Var Files
  - startTime: 3642
    title: 'Key Requirement: Speed, Local Dev/Test, Predicting Changes'
  - startTime: 3647
    title: Configuration Management with Vars (Loading Vars)
  - startTime: 3648
    title: Hands-on Demonstration Setup (Kind Cluster)
  - startTime: 3655
    title: Deploying an Application (NGINX example)
  - startTime: 3863
    title: 'Loading Vars from Various Sources (HTTP, Git, Cluster ConfigMaps/Secrets)'
  - startTime: 3938
    title: Discussing Cluster ConfigMaps for Environment Config
  - startTime: 4060
    title: Integrating Helm Charts
  - startTime: 4295
    title: Helm Chart Pre-pulling
  - startTime: 4337
    title: Helm Values File
  - startTime: 4350
    title: Templating Helm Values
  - startTime: 4389
    title: Deploying Helm Chart (Pod Info)
  - startTime: 4489
    title: Templating Helm Values Example (Change Color)
  - startTime: 4582
    title: Diff shows changes from Templated Helm Values
  - startTime: 4659
    title: Updating Helm Charts (`kluctl helm update`)
  - startTime: 4895
    title: 'Kluctl Hooks & Annotations (Helm Hooks, Force Apply, Delete)'
  - startTime: 5140
    title: Wrap-up and Discussion
  - startTime: 5497
    title: Conclusion
duration: 5556
---

