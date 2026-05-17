---
id: ufjrlupsc2rko3zckf49bwv6
slug: laravel-on-kubernetes-into-production
title: 'Laravel on Kubernetes: Into Production'
description: >-
  Alex Bowers joins David to take a Laravel app from a basic deploy to a
  production-grade Kubernetes setup, wiring up MariaDB via Helm, ConfigMaps and
  Secrets, init-container migrations, CronJob schedulers, queue worker
  Deployments, and update strategies.
publishedAt: 2021-01-23T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - laravel
  - php
  - docker
  - helm
  - artifacthub
  - sops
  - kapitan
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 45
    title: Introductions
  - startTime: 48
    title: Introduction
  - startTime: 92
    title: Project Setup and Topics to Cover
  - startTime: 160
    title: 'Context: what do we need to do?'
  - startTime: 240
    title: Reviewing Docker Files
  - startTime: 360
    title: Getting the app deployed to Kubernetes
  - startTime: 381
    title: Planning Database Migrations
  - startTime: 725
    title: Deploying the Database
  - startTime: 925
    title: Adding Database Service
  - startTime: 1009
    title: Debugging Database Deployment
  - startTime: 1090
    title: Introduction to Resource Limits
  - startTime: 1095
    title: Kubernetes resource constraints
  - startTime: 1250
    title: 'ImagePullPolicies: working with local images'
  - startTime: 1252
    title: Debugging Image Pull Policy
  - startTime: 1340
    title: Initial Application Errors and Permissions
  - startTime: 1440
    title: Adding volumes for ephemeral / cache data
  - startTime: 1480
    title: Managing File Permissions with Volumes (emptyDir)
  - startTime: 2100
    title: Configuring our applications with ConfigMaps
  - startTime: 2118
    title: Configuration Management with ConfigMaps
  - startTime: 2496
    title: Debugging Config and Logging
  - startTime: 3110
    title: Generating Application Key
  - startTime: 3199
    title: Application Successfully Running
  - startTime: 3300
    title: Kubernetes secrets
  - startTime: 3301
    title: Managing Secrets
  - startTime: 3640
    title: Database migrations
  - startTime: 3675
    title: Database Migrations (Init Container)
  - startTime: 3964
    title: Discussing Init Container Idempotency
  - startTime: 4020
    title: Jobs and CronJobs for scheduled tasks and queues
  - startTime: 4036
    title: Scheduled Tasks and Queue Jobs Overview
  - startTime: 4070
    title: Implementing Scheduled Tasks (CronJob)
  - startTime: 4328
    title: Debugging Scheduled Tasks
  - startTime: 4466
    title: Implementing Queue Workers (Deployment)
  - startTime: 4703
    title: Discussing Queue Workers and Resource Allocation
  - startTime: 4920
    title: Safe updates with deployment update strategies
  - startTime: 4958
    title: Discussing Release and Deployment Strategies
  - startTime: 5196
    title: Conclusion
duration: 5259
guests:
  - alex-bowers
resources:
  - title: Alex Bowers Laravel example project
    type: url
    category: code
  - title: Artifact Hub MariaDB Helm chart
    type: url
    url: 'https://artifacthub.io/'
    category: other
  - title: Mozilla SOPS
    type: url
    url: 'https://github.com/getsops/sops'
    category: code
  - title: Sealed Secrets
    type: url
    url: 'https://github.com/bitnami-labs/sealed-secrets'
    category: code
  - title: Kapitan project
    type: url
    url: 'https://kapitan.dev/'
    category: code
---

