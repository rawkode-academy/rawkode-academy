---
id: hands-on-introduction-to-krr-kubernetes-resource-recommendations
slug: hands-on-introduction-to-krr-kubernetes-resource-recommendations
title: Hands-on Introduction to KRR (Kubernetes Resource Recommendations)
description: >-
  Robusta KRR (Kubernetes Resource Recommender) is a CLI tool for optimizing
  resource allocation in Kubernetes clusters. It gathers pod usage data from
  Prometheus and recommends requests and limits for CPU and memory. This reduces
  costs and improves performance.


  Features

  - No Agent Required: Robusta KRR is a CLI tool that runs on your local
  machine. It does not require running Pods in your cluster.

  - Prometheus Integration: Gather resource usage data using built-in Prometheus
  queries, with support for custom queries coming soon.

  - Extensible Strategies: Easily create and use your own strategies for
  calculating resource recommendations.

  - Future Support: Upcoming versions will support custom resources (e.g. GPUs)
  and custom metrics.

  - Resource Allocation Statistics


  According to a recent Sysdig study, on average, Kubernetes clusters have:


  - 69% unused CPU

  - 18% unused memory


  By right-sizing your containers with KRR, you can save an average of 69% on
  cloud costs.
publishedAt: 2023-05-25T17:00:00.000Z
technologies:
  - krr
show: rawkode-live
videoId: fd5l8yd2xbh033dpnkvftg35
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 148
    title: Welcome
  - startTime: 149
    title: Introduction and Guest Welcome
  - startTime: 208
    title: What is Robust
  - startTime: 210
    title: Introduction to Robusta and its Mission
  - startTime: 289
    title: Challenges with Kubernetes
  - startTime: 313
    title: The Challenge of Kubernetes Resource Optimization
  - startTime: 490
    title: Tradeoffs
  - startTime: 610
    title: Understanding Kubernetes Resource Requests and Limits
  - startTime: 713
    title: Why KRR
  - startTime: 718
    title: Motivation for Building KRR
  - startTime: 841
    title: Proprietary Tools
  - startTime: 920
    title: KRR vs VP
  - startTime: 1080
    title: KRR Command Line Demo
  - startTime: 1293
    title: Analyzing KRR Recommendations
  - startTime: 1337
    title: Overprovisioning
  - startTime: 1520
    title: Visualizing and Validating Recommendations (Upcoming)
  - startTime: 1706
    title: Scheduling Concerns
  - startTime: 1736
    title: 'Q&A: Node Utilization and Idle Time Reporting'
  - startTime: 1825
    title: Other Strategies
  - startTime: 1826
    title: Future KRR Strategies and Auto-Configuration
  - startTime: 2289
    title: KRR Integration with Robusta
  - startTime: 2545
    title: Scaling KRR
  - startTime: 2626
    title: Future of KRR
  - startTime: 2630
    title: 'Future: Beyond CPU/Memory & Capacity Planning'
  - startTime: 2807
    title: Memory Allocation
  - startTime: 2846
    title: Container IOPS
  - startTime: 2947
    title: Call for Feedback
  - startTime: 3061
    title: Last Question
  - startTime: 3073
    title: 'Q&A: KRR vs. Goldilocks'
  - startTime: 3188
    title: Conclusion
duration: 3267
---

