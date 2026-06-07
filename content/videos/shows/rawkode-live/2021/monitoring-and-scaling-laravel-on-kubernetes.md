---
id: aby09ynwn40wa8dtsvxwf7ho
slug: monitoring-and-scaling-laravel-on-kubernetes
title: Monitoring & Scaling Laravel on Kubernetes
description: >-
  Continuing the Laravel-on-Kubernetes series, David is joined by Alex Bowers
  and Ciaran McNulty to load-test with Siege, wire up a CPU-based HPA via
  metrics-server, then layer Linkerd sidecars, Grafana dashboards, and a
  Prometheus ServiceMonitor for custom application metrics.
whatYouWillLearn:
  - "Load-test a Laravel app with Siege to expose CPU and latency pressure."
  - "Use Linkerd, Grafana, and Prometheus to inspect request-level service metrics."
  - "Configure custom Prometheus metrics for HPA scaling beyond raw CPU."
publishedAt: 2021-02-24T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - laravel
  - php
  - linkerd
  - prometheus
  - grafana
show: rawkode-live
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
guests:
  - ciaranmcnulty
  - alexbowers
resources:
  - title: JoeDog Siege
    type: url
    url: 'https://www.joedog.org/'
    category: other
  - title: Prometheus Operator quick start bundle
    type: url
    url: 'https://github.com/prometheus-operator/kube-prometheus'
    category: documentation
  - title: Prometheus Adapter
    type: url
    url: 'https://github.com/kubernetes-sigs/prometheus-adapter'
    category: documentation
  - title: Sean Hood OpenTelemetry package
    type: url
    url: 'https://github.com/SeanHood/laravel-opentelemetry'
    category: code
  - title: Alex Bowers Laravel example project
    type: url
    url: 'https://github.com/alexbowers/laravel-example-project'
    category: code
---
