---
id: o91kaudm4lsng4edd88nanlr
slug: hands-on-with-policy-reporter
title: Hands-on with Policy Reporter
description: >-
  Frank Jogeleit joins to walk through Policy Reporter, the open source tool
  that turns Kyverno PolicyReports into Prometheus metrics, a UI dashboard, and
  notifications. We install it via Helm alongside kube-prometheus and explore
  Grafana dashboards for policy violations.
whatYouWillLearn:
  - "Displays Kyverno PolicyReports as searchable violations, audit results, and cluster-wide compliance records."
  - "Installs Policy Reporter with Helm, then optionally enables a standalone UI deployment."
  - "Connects policy violations to Prometheus metrics, Grafana dashboards, and alerting targets."
publishedAt: 2021-04-08T17:00:00.000Z
type: live
category: tutorial
technologies:
  - falco
  - grafana
  - helm
  - kyverno
  - policy-reporter
  - prometheus
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 91
    title: Introduction to Policy Reporter
  - startTime: 164
    title: Introducing the Creator
  - startTime: 258
    title: Policy Reporter Overview & Motivation
  - startTime: 260
    title: What is Policy Reporter?
  - startTime: 426
    title: Policy Reporter vs. Other Tools
  - startTime: 489
    title: Understanding Falco and Kiverno
  - startTime: 596
    title: Hands-on Setup
  - startTime: 660
    title: Installing Policy Reporter
  - startTime: 679
    title: Installing the Policy Reporter UI (Helm)
  - startTime: 795
    title: Exploring the Policy Reporter UI
  - startTime: 800
    title: Policy Reporter UI
  - startTime: 1155
    title: Policy Modes (Audit vs. Enforce)
  - startTime: 1432
    title: Integrating with Prometheus & Grafana
  - startTime: 1440
    title: Integrating with Prometheus and Grafana
  - startTime: 1941
    title: Exploring Grafana Dashboards
  - startTime: 2392
    title: Notifications and Policy Priorities
  - startTime: 2614
    title: Future of Policy Reporter
  - startTime: 2705
    title: Community & Closing
duration: 2831
guests:
  - fjogeleit
resources:
  - title: Falcosidekick UI
    type: url
    url: 'https://github.com/falcosecurity/falcosidekick-ui'
    category: code
  - title: Kyverno Pod Security Policy replacement policies
    type: url
    url: 'https://kyverno.io/policies/pod-security/'
    category: documentation
---
