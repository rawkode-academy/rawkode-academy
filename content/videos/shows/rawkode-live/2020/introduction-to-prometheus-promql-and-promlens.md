---
id: introduction-to-prometheus-promql-and-promlens
slug: introduction-to-prometheus-promql-and-promlens
title: 'Introduction to Prometheus, PromQL, & PromLens'
description: "In this episode, I am joined by Julius Volz; co-founder of Prometheus, and founder of PromCon and PromLabs.\n\nPrometheus is an open-source systems monitoring and alerting toolkit originally built at SoundCloud. Since its inception in 2012, many companies and organisations have adopted Prometheus, and the project has a very active developer and user community. It is now a standalone open source project and maintained independently of any company. To emphasise this, and to clarify the project's governance structure, Prometheus joined the Cloud Native Computing Foundation in 2016 as the second hosted project, after Kubernetes.\n\n\nPromQL, the query language of the Prometheus monitoring system, is great for doing calculations on time series data. However, the language also has plenty of sharp edges and can be challenging to learn and work with for both beginners and more advanced users. Whether it's knowing the language itself, reading complicated queries, or understanding the shape of the data you have to work with, there is often a lot of pain and guesswork involved. In the worst case, you might not notice that your service is down because an alerting expression is incorrect.\n\nPromLens is a tool by PromLabs that makes learning and using PromQL easier and more productive. It integrates a visual query builder with explanation and visualization features. It also allows you to share queries with colleagues or friends.\n\n\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:30 - Introductions\n02:30 - What is Prometheus?\n08:00 - Why write your own database?\n15:00 - Running Prometheus\n18:00 - Prometheus configuration\n21:00 - Exploring and understanding Prometheus metrics\n38:00 - Querying with the Prometheus UI\n40:00 - Adding the node_exporter\n45:00 - A new UI: PromLens\n48:10 - Using the rate function\n50:20 - Why PromLens and a look at its editor and features\n1:00:15 - Contrived situation - lets fill up the disk\n1:24:00 - Final thoughts\n1:25:00 - Viewer question: What metrics are important for a web application?\n\n\n\U0001F481\U0001F3FB‍♂️    Want some help?\n\n\U0001F4AC  Leave a comment\n\U0001F426  Ping me on Twitter - https://twitter.com/rawkode\n\U0001F4C6  Schedule some time during my office-hours - https://rawko.de/office-hours\n\n\n\U0001F30E    Links\n\nJulius Volz - https://twitter.com/juliusvolz\nPrometheus - https://prometheus.io\nPromLens - https://promlens.com"
publishedAt: 2020-10-10T17:00:00.000Z
technologies:
  - prometheus
  - promlens
show: rawkode-live
videoId: chf9r0pa0ypqa70iucjn897m
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
---

