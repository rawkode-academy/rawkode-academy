---
id: wth5h0zbyz34gd904nuiuauu
slug: monitoring-and-scaling-laravel-on-kubernetes-part-ii
title: Monitoring & Scaling Laravel on Kubernetes (Part II)
description: >-
  Leo joins Alex and David to wire Prometheus middleware into Laravel, scrape
  the metrics endpoint, deploy the Prometheus Adapter, and drive a Horizontal
  Pod Autoscaler with custom metrics under load from Siege.
whatYouWillLearn:
  - "Wire Prometheus middleware into Laravel so application requests become scrapeable metrics."
  - "Annotate the Kubernetes deployment so Prometheus can discover and scrape the metrics endpoint."
  - "Install the Prometheus Adapter, define custom metrics rules, and drive HPA scaling from response time."
publishedAt: 2021-03-03T17:00:00.000Z
type: live
category: tutorial
technologies:
  - docker
  - kubernetes
  - laravel
  - php
  - prometheus
show: rawkode-live
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
guests:
  - alexbowers
  - phroggyy
resources:
  - title: Prometheus Adapter for Kubernetes Metrics APIs
    type: url
    category: code
    url: 'https://github.com/kubernetes-sigs/prometheus-adapter'
  - title: Horizontal Pod Autoscaler
    type: url
    category: documentation
    url: 'https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/'
  - title: Siege HTTP load tester
    type: url
    category: code
    url: 'https://github.com/JoeDog/siege'
---
