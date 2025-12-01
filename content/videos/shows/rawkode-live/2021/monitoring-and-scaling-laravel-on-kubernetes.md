---
id: monitoring-and-scaling-laravel-on-kubernetes
slug: monitoring-and-scaling-laravel-on-kubernetes
title: Monitoring & Scaling Laravel on Kubernetes
description: "In this episode, we'll take a look at auto-scaling our Laravel application based on metrics.\nPlease be aware, we couldn't find a working Prometheus library for Laravel that worked. We did successfully get external request metrics with Linkerd sidecar, but not custom metrics instrumented in PHP.\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n03:50 - What did we do last time?\n16:30 - Installing siege\n19:50 - Creating the Horizontal Pod AutoScaler (HPA)\n24:40 - Deploying Metric Server\n32:00 - Triggering an AutoScale Event with siege\n46:00 - Adding Linkerd Sidecar for Request Metric Collection\n1:02:00 - Attempting to add Prometheus Middleware to Laravel\n\n\U0001F465 About the Guests\n\nCiaran McNulty\n\n  Ciaran helps teams at all levels of ability improve via training and \ncoaching. He has been a PHP professional since the late 90s and is \npassionate about TDD, BDD and Agile methodologies. He is lead maintainer\n of PhpSpec.\n\n\n\U0001F426 https://twitter.com/ciaranmcnulty\n\U0001F9E9 https://github.com/ciaranmcnulty\n\U0001F30F https://ciaranmcnulty.com\n\n\nAlex Bowers\n\n  Alex is the Lead Developer at Shopblocks. Primarily working with Laravel, VueJS, and dabbling with Rust; Alex enjoys bridging his time between development and infrastructure with Ansible.\n\n\n\U0001F426 https://twitter.com/bowersbros\n\U0001F9E9 https://github.com/alexbowers\n\n\n\n\U0001F528 About the Technologies\n\nLaravel\n\nLaravel is a web application framework with expressive, elegant syntax. A web framework provides a structure and starting point for creating your application, allowing you to focus on creating something amazing while we sweat the details.\nLaravel strives to provide an amazing developer experience, while providing powerful features such as thorough dependency injection, an expressive database abstraction layer, queues and scheduled jobs, unit and integration testing, and more.\nWhether you are new to PHP or web frameworks or have years of experience, Laravel is a framework that can grow with you.\n\n\U0001F30F https://laravel.com\n\U0001F426 https://twitter.com/laravelphp\n\U0001F9E9 https://github.com/laravel/laravel\n\n#Laravel #PHP\n\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/alexbowers/laravel-example-project"
publishedAt: 2021-02-24T17:00:00.000Z
technologies:
  - kubernetes
  - laravel
  - php
show: rawkode-live
videoId: aby09ynwn40wa8dtsvxwf7ho
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 76
    title: Introduction
  - startTime: 230
    title: What did we do last time?
  - startTime: 390
    title: Building and Deploying Initial Application
  - startTime: 760
    title: Discussion on Auto Scaling Goals
  - startTime: 858
    title: Preparing for Load Testing & Installing Siege
  - startTime: 990
    title: Installing siege
  - startTime: 1110
    title: Initial Load Test & Observing Performance
  - startTime: 1190
    title: Creating the Horizontal Pod AutoScaler (HPA)
  - startTime: 1195
    title: Introducing Kubernetes Horizontal Pod Autoscaler (HPA)
  - startTime: 1271
    title: Creating CPU-Based HPA
  - startTime: 1350
    title: Attempting CPU Scaling & Debugging Metrics
  - startTime: 1480
    title: Deploying Metric Server
  - startTime: 1490
    title: Deploying & Debugging Metrics Server
  - startTime: 1810
    title: Fixing Metrics Server Issue
  - startTime: 1877
    title: Successful CPU-Based Auto Scaling Demo
  - startTime: 1920
    title: Triggering an AutoScale Event with siege
  - startTime: 2297
    title: Discussing Limitations of Resource Scaling
  - startTime: 2490
    title: Introducing Service Mesh (Linkerd) for Metrics
  - startTime: 2610
    title: Installing & Setting up Linkerd
  - startTime: 2760
    title: Adding Linkerd Sidecar for Request Metric Collection
  - startTime: 3000
    title: Exploring Linkerd UI and Grafana Metrics
  - startTime: 3330
    title: Exploring Raw Prometheus Metrics
  - startTime: 3690
    title: Transition to Custom Application Metrics
  - startTime: 3720
    title: Attempting to add Prometheus Middleware to Laravel
  - startTime: 3826
    title: Attempting Laravel Prometheus Package Integration
  - startTime: 5220
    title: Dependency & Compatibility Issues with Packages
  - startTime: 5735
    title: Adding Manual Prometheus Metrics Endpoint
  - startTime: 5995
    title: Building and Deploying with Manual Endpoint
  - startTime: 6065
    title: Confirming Manual Metrics Endpoint Works
  - startTime: 6090
    title: Attempting Prometheus Scraping via ServiceMonitor
  - startTime: 6325
    title: Debugging ServiceMonitor Configuration
  - startTime: 6598
    title: Conclusion & Wrap-up
duration: 6965
---

