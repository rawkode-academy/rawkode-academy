---
id: chf9r0pa0ypqa70iucjn897m
slug: introduction-to-prometheus-promql-and-promlens
title: 'Introduction to Prometheus, PromQL, & PromLens'
description: >-
  In this episode, I am joined by Julius Volz; co-founder of Prometheus, and
  founder of PromCon and PromLabs.
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
    category: other
    evidence_quote: >-
      By the way, there is a Chrome plugin, which is really cool. It's called
      Prometheus Formatter.
    confidence: high
  - title: Prometheus best practices docs page on histograms and summaries
    category: documentation
    evidence_quote: >-
      There's a page in the Prometheus best practices docs that really goes
      deeper into that comparison if if someone wants to look at that more.
    confidence: medium
  - title: kube-prometheus Prometheus rules manifests
    category: code
    evidence_quote: >-
      If you go to if you search for cube dash Prometheus, which is a project
      initially by oh, sorry. No. Like, Google. Yeah. Yeah. Dash dash
      Prometheus. Yep. That's fine. And then press t, and then you press rules.
      And then you go to the manifest slash Prometheus rules.
    confidence: medium
  - title: Cortex monitoring project
    category: code
    evidence_quote: >-
      There's, for example, Cortex initially started by Weaveworks. Now it's
      more dominant, I guess, lead led by Grafana Labs and others
    confidence: medium
---

