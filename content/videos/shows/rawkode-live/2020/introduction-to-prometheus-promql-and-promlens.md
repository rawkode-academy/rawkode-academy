---
id: chf9r0pa0ypqa70iucjn897m
slug: introduction-to-prometheus-promql-and-promlens
title: 'Introduction to Prometheus, PromQL, & PromLens'
description: >-
  Julius Volz, Prometheus co-founder, walks through the data model and four
  metric types, scraping node_exporter, writing PromQL in PromLens, and
  building a predict_linear disk-fill alert.
publishedAt: 2020-10-10T17:00:00.000Z
type: live
category: tutorial
technologies:
  - prometheus
  - promlens
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 90
    title: Introductions
  - startTime: 91
    title: Introduction
  - startTime: 150
    title: What is Prometheus?
  - startTime: 166
    title: What is Prometheus? (Overview & Core Concepts)
  - startTime: 480
    title: Why write your own database?
  - startTime: 502
    title: Why build a custom Time Series Database?
  - startTime: 900
    title: Running Prometheus
  - startTime: 902
    title: Installing Prometheus
  - startTime: 1064
    title: Prometheus Configuration (prometheus.yml)
  - startTime: 1080
    title: Prometheus configuration
  - startTime: 1177
    title: Running Prometheus & Web UI
  - startTime: 1260
    title: Exploring and understanding Prometheus metrics
  - startTime: 1411
    title: 'Data Model & Metric Types (Counter, Gauge, Histogram, Summary)'
  - startTime: 2135
    title: Are Metric Types Strictly Enforced? (Q&A)
  - startTime: 2280
    title: Querying with the Prometheus UI
  - startTime: 2308
    title: Querying Internal Metrics (PromQL Basics)
  - startTime: 2400
    title: Adding the node_exporter
  - startTime: 2412
    title: Installing Node Exporter
  - startTime: 2583
    title: Adding Node Exporter to Prometheus Configuration
  - startTime: 2700
    title: 'A new UI: PromLens'
  - startTime: 2705
    title: Introduction to PromLens
  - startTime: 2840
    title: Querying Node Exporter Metrics in PromLens
  - startTime: 2890
    title: Using the rate function
  - startTime: 3020
    title: Why PromLens and a look at its editor and features
  - startTime: 3046
    title: 'PromLens Features Deep Dive (Visualization, Editing, Explanation)'
  - startTime: 3615
    title: Contrived situation - lets fill up the disk
  - startTime: 3673
    title: Predicting Disk Usage with PromQL (predict_linear function)
  - startTime: 4714
    title: Real-World Alerting Example (Kube-Prometheus Disk Alert)
  - startTime: 4950
    title: >-
      Other Prometheus Topics (Service Discovery, Alertmanager, Exporters,
      Remote Storage)
  - startTime: 5040
    title: Final thoughts
  - startTime: 5100
    title: 'Viewer question: What metrics are important for a web application?'
  - startTime: 5115
    title: 'Q&A: Monitoring Web Applications (RED Metrics)'
  - startTime: 5264
    title: Conclusion
duration: 5335
guests:
  - julius-volz
resources:
  - title: Prometheus Formatter Chrome extension
    type: url
    category: other
  - title: Prometheus best practices docs page on histograms and summaries
    type: url
    url: 'https://prometheus.io/docs/practices/histograms/'
    category: documentation
  - title: kube-prometheus Prometheus rules manifests
    type: url
    url: 'https://github.com/prometheus-operator/kube-prometheus/tree/main/manifests'
    category: code
  - title: Cortex monitoring project
    type: url
    url: 'https://cortexmetrics.io/'
    category: other
---

