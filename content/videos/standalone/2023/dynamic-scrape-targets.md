---
id: hmi73u4rxevdc9jb39tu1lxq
slug: dynamic-scrape-targets
title: Dynamic Scrape Targets
description: >-
  Configure the Parca config map with a Prometheus-style scrape job that uses
  Kubernetes service discovery, keeps pods by parca.dev annotations, and adds
  the cluster role binding needed to scrape an InfluxDB 2 pprof endpoint.
publishedAt: 2023-07-11T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - parca
  - kubernetes
  - prometheus
  - influxdb
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 10
    title: Why Dynamic Scrape Targets? (Parca Agent vs. Dynamic Scraping)
  - startTime: 85
    title: Plan and Example Scenario (Using InfluxDB2)
  - startTime: 114
    title: Initial Setup and Parca UI State (No Data/Targets)
  - startTime: 179
    title: Configuring Parca Scrape Targets (Modifying Parca Config Map)
  - startTime: 235
    title: 'Explaining the Scrape Config (Job, Service Discovery, Relabeling)'
  - startTime: 335
    title: Granting Parca Kubernetes Permissions (RBAC Setup)
  - startTime: 394
    title: Applying Configuration Changes (Config Map & RBAC)
  - startTime: 412
    title: 'Checking Parca Targets (Job Appears, No Targets Yet)'
  - startTime: 428
    title: Adding Annotations to Workload (InfluxDB2 StatefulSet)
  - startTime: 488
    title: Verifying Scrape Targets Discovered (Target Appears in Parca)
  - startTime: 525
    title: Viewing Collected Profiles
  - startTime: 561
    title: Summary and Conclusion
duration: 610
guests: []
resources:
  - type: url
    title: Parca scrape configuration documentation
    category: documentation
    url: 'https://www.parca.dev/docs/'
  - type: url
    title: Prometheus Kubernetes service discovery
    category: documentation
    url: 'https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config'
  - type: url
    title: InfluxDB 2 pprof endpoint
    category: documentation
    url: 'https://docs.influxdata.com/influxdb/v2/'
---

