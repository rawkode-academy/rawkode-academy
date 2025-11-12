---
id: monitoring-and-scaling-laravel-on-kubernetes-part-ii
slug: monitoring-and-scaling-laravel-on-kubernetes-part-ii
title: Monitoring & Scaling Laravel on Kubernetes (Part II)
description: "In this episode, we'll take a look at auto-scaling our Laravel application based on metrics.\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:45 - Introductions\n03:20 - What did we do last time?\n05:20 - Adding Cloud Native / Prometheus Library to Laravel\n34:00 - Adding Load with Siege\n39:20 - Recap: Metric Server\n40:00 - Deploying the Prometheus Adapter\n1:05:25 - Adding Our Horizontal Pod AutoScaler (HPA)\n\n\U0001F465 About the Guests\n\nAlex Bowers\n\n  Alex is the Lead Developer at Shopblocks. Primarily working with Laravel, VueJS, and dabbling with Rust; Alex enjoys bridging his time between development and infrastructure with Ansible.\n\n\n\U0001F426 https://twitter.com/bowersbros\n\U0001F9E9 https://github.com/alexbowers\n\n\n\nLeo Sjöberg\n\n  CTO @ Jobilla – building the best recruitment software in the service sector.\n\n\n\U0001F426 https://twitter.com/Phroggyy\n\U0001F9E9 https://github.com/Phroggyy\n\n\n\n\U0001F528 About the Technologies\n\nLaravel\n\nLaravel is a web application framework with expressive, elegant syntax. A web framework provides a structure and starting point for creating your application, allowing you to focus on creating something amazing while we sweat the details.\nLaravel strives to provide an amazing developer experience, while providing powerful features such as thorough dependency injection, an expressive database abstraction layer, queues and scheduled jobs, unit and integration testing, and more.\nWhether you are new to PHP or web frameworks or have years of experience, Laravel is a framework that can grow with you.\n\n\U0001F30F https://laravel.com\n\U0001F426 https://twitter.com/laravelphp\n\U0001F9E9 https://github.com/laravel/laravel\n\n#Laravel #PHP\n\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/jobilla/laravel-cloud-native-utilities"
publishedAt: 2021-03-03T17:00:00.000Z
technologies:
  - kubernetes
  - laravel
  - php
show: rawkode-live
videoId: wth5h0zbyz34gd904nuiuauu
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 45
    title: Introductions
  - startTime: 71
    title: Introduction & Recap of Part I
  - startTime: 104
    title: Introducing Leo & Laravel Prometheus Middleware
  - startTime: 200
    title: What did we do last time?
  - startTime: 201
    title: Environment Setup & Initial Deployment Overview
  - startTime: 320
    title: Adding Cloud Native / Prometheus Library to Laravel
  - startTime: 327
    title: Installing PHP Dependencies (APCu Extension)
  - startTime: 668
    title: Integrating the Middleware & Fixing Docker Build Steps
  - startTime: 1088
    title: Testing the Laravel Metrics Endpoint (/metrics)
  - startTime: 1342
    title: Configuring Prometheus Scraping (Kubernetes Annotations)
  - startTime: 1455
    title: Troubleshooting Prometheus Scraping
  - startTime: 1970
    title: 'Discussion: HPA & Scaling Based on Response Time'
  - startTime: 2040
    title: Adding Load with Siege
  - startTime: 2358
    title: Installing Prometheus Adapter for Custom Metrics
  - startTime: 2360
    title: 'Recap: Metric Server'
  - startTime: 2400
    title: Deploying the Prometheus Adapter
  - startTime: 2580
    title: Debugging Custom Metrics API Access
  - startTime: 2719
    title: Fixing Prometheus Adapter Configuration (Prometheus Service Endpoint)
  - startTime: 3172
    title: Defining Prometheus Adapter Rules (PromQL Series Queries)
  - startTime: 3892
    title: Confirming Custom Metric Availability via API
  - startTime: 3918
    title: Configuring the Horizontal Pod Autoscaler (HPA) Definition
  - startTime: 3925
    title: Adding Our Horizontal Pod AutoScaler (HPA)
  - startTime: 3999
    title: 'Discussion: HPA Scaling Logic & Cooldown'
  - startTime: 4098
    title: Demonstrating HPA Scaling with Load (Running Siege)
  - startTime: 4258
    title: Observing Pod Scale Up
  - startTime: 4301
    title: Observing Pod Scale Down & Conclusion
duration: 4580
---

