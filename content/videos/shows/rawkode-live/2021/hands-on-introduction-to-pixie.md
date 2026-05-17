---
id: ymhs0sxdh5vb6uwi88xcfiuw
slug: hands-on-introduction-to-pixie
title: Hands-on Introduction to Pixie
description: >-
  Natalie Serrino walks through Pixie, the eBPF-powered Kubernetes observability
  tool. We deploy Vizier with the etcd operator, explore PxL scripts, trace HTTP
  and gRPC traffic, view flame graphs, and wire up a Slack alert via the Go
  client.
publishedAt: 2021-07-08T17:00:00.000Z
type: live
category: tutorial
technologies:
  - pixie
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 51
    title: Introductions
  - startTime: 53
    title: Introduction and Housekeeping
  - startTime: 98
    title: Guest Introduction (Natalie Serino)
  - startTime: 169
    title: What is Pixie? Zero Code Instrumentation via eBPF
  - startTime: 170
    title: What is Pixie?
  - startTime: 255
    title: How eBPF Powers Pixie
  - startTime: 388
    title: CNCF Sandbox Project
  - startTime: 393
    title: Pixie Open Source & CNCF Sandbox Project
  - startTime: 553
    title: Deploying Pixie
  - startTime: 803
    title: 'Pixie Architecture Explained (Edge Storage, PEMs)'
  - startTime: 1038
    title: Running Scripts in the CLI & UI
  - startTime: 1042
    title: 'Running First Pixie CLI Query (`px script list`, `px namespaces`)'
  - startTime: 1173
    title: Introduction to PixelScript (PXL)
  - startTime: 1250
    title: Exploring the Pixie UI and Default Scripts (`px cluster`)
  - startTime: 1319
    title: Pixie Stores Data on the Cluster
  - startTime: 1480
    title: Inspect a Script
  - startTime: 1724
    title: Flamegraph (Continuous Profiling)
  - startTime: 1791
    title: 'Viewer Question: Profiling Impact and Performance'
  - startTime: 1929
    title: 'Supported Protocols (HTTP, gRPC, DBs, TLS, etc.)'
  - startTime: 1947
    title: Protocols Traced by Pixie
  - startTime: 2131
    title: NetFlow Graph and Network Traffic Visibility
  - startTime: 2135
    title: Network Flow Graph Script
  - startTime: 2396
    title: HTTP Data Script (Full Request & Response Body)
  - startTime: 2405
    title: Viewing Raw HTTP Request Data (`http_events`)
  - startTime: 2450
    title: 'Editing a Script: Filter HTTP Requests for Errors'
  - startTime: 2451
    title: Filtering & Aggregating Data with PixelScript
  - startTime: 2850
    title: Learning PixelScript and Discovering Schema (`px schema`)
  - startTime: 2872
    title: 'Viewer Question: Go eBPF Contributions'
  - startTime: 2948
    title: Using the Pixie API to Create Slack Alerts
  - startTime: 2951
    title: Client APIs and Automating Queries
  - startTime: 3049
    title: Setting up an Error Alert via Slack Bot (API/SDK Demo)
  - startTime: 3540
    title: Reviewing the Error Alert PixelScript
  - startTime: 3541
    title: Data Source Tables
  - startTime: 3707
    title: 'Workflow Summary: Build Scripts in UI/CLI, Automate with SDKs'
  - startTime: 3781
    title: Running Custom Scripts from CLI (`px run`)
  - startTime: 3833
    title: Interactive CLI Exploration (`px live`)
  - startTime: 3856
    title: Wrap Up
  - startTime: 3920
    title: Wrap-up and Further Resources
  - startTime: 3970
    title: 'Viewer Question: Self-Hosting Pixie'
  - startTime: 3998
    title: Conclusion and Farewell
duration: 4066
guests:
  - natalie-serrino
resources:
  - title: Pixie supported data sources documentation
    type: url
    url: 'https://docs.px.dev/about-pixie/data-sources/'
    category: documentation
  - title: Pixie Grafana data source plugin
    type: url
    url: 'https://github.com/pixie-io/grafana-plugin'
    category: code
  - title: Pixie Slack alert tutorial
    type: url
    url: 'https://docs.px.dev/tutorials/integrations/slackbot-alert/'
    category: documentation
  - title: PxL operators reference documentation
    type: url
    url: 'https://docs.px.dev/reference/pxl/operators/'
    category: documentation
  - title: Pixie Socks Shop demo
    type: url
    category: demos
---

