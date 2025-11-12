---
id: laravel-on-kubernetes-into-production
slug: laravel-on-kubernetes-into-production
title: 'Laravel on Kubernetes: Into Production'
description: "In this episode, we'll explore the \"What next?\" question that is often left in developers heads after they've deployed their Laravel application to Kubernetes. We'll tackle queue processing, jobs and scheduled tasks, database migrations, safe upgrades and continuous deployment, centralised logging, secrets management, and application monitoring.\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding Screen\n00:45 - Introductions\n02:40 - Context: what do we need to do?\n06:00 - Getting the app deployed to Kubernetes\n18:15 - Kubernetes resource constraints\n20:50 - ImagePullPolicies: working with local images\n24:00 - Adding volumes for ephemeral / cache data\n35:00 - Configuring our applications with ConfigMaps\n55:00 - Kubernetes secrets\n01:00:40 - Database migrations\n01:07:00 - Jobs and CronJobs for scheduled tasks and queues\n01:22:00 - Safe updates with deployment update strategies\n\n\U0001F465 About the Guests\n\nAlex Bowers\n\n  Alex is the Lead Developer at Shopblocks. Primarily working with Laravel, VueJS, and dabbling with Rust; Alex enjoys bridging his time between development and infrastructure with Ansible.\n\n\n\U0001F426 https://twitter.com/bowersbros\n\U0001F9E9 https://github.com/alexbowers\n\n\n\n\U0001F528 About the Technologies\n\nLaravel\n\nLaravel is a web application framework with expressive, elegant syntax. A web framework provides a structure and starting point for creating your application, allowing you to focus on creating something amazing while we sweat the details.\nLaravel strives to provide an amazing developer experience, while providing powerful features such as thorough dependency injection, an expressive database abstraction layer, queues and scheduled jobs, unit and integration testing, and more.\nWhether you are new to PHP or web frameworks or have years of experience, Laravel is a framework that can grow with you.\n\n\U0001F30F https://laravel.com\n\U0001F426 https://twitter.com/laravelphp\n\U0001F9E9 https://github.com/laravel/laravel\n\n#Laravel #PHP\n\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/alexbowers/laravel-example-project"
publishedAt: 2021-01-23T17:00:00.000Z
technologies:
  - kubernetes
  - laravel
  - php
show: rawkode-live
videoId: ufjrlupsc2rko3zckf49bwv6
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
---

