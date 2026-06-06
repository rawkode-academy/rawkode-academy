---
id: dpcat5afr4tp3p580cp0370w
slug: alex-jones-and-alistair-hey
title: Alex Jones & Alistair Hey
description: >-
  Alex Jones and Alistair Hay break each other's Kubernetes clusters. Alex hunts
  a disabled replica set controller, a blocking NetworkPolicy, and a tampered
  cluster DNS IP. Alistair unwinds tc traffic-control delays, a rogue kubectl
  alias, and dropping iptables rules.
publishedAt: 2022-11-11T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - coredns
  - teleport
  - postgresql
show: klustered
chapters:
  - startTime: 124
    title: Introduction & Welcome
  - startTime: 144
    title: 'Sponsor Thank You (Equinix Metal, Teleport)'
  - startTime: 180
    title: 'Guest Introductions (Alex Jones, Alistair Hay)'
  - startTime: 270
    title: Alex Fixes Alistair's Cluster (Challenge 1 Starts)
  - startTime: 312
    title: 'Initial Host Checks (Files, Aliases)'
  - startTime: 404
    title: Testing Kubectl
  - startTime: 604
    title: API Server Logs (Webhook Issue)
  - startTime: 641
    title: Fixing Admission Webhook
  - startTime: 660
    title: Scheduling Issues Begin
  - startTime: 786
    title: Debugging Scheduling (Simple Pod Test)
  - startTime: 853
    title: Checking Journal/System Logs
  - startTime: 900
    title: Debugging Controller Manager (Replica Set Disabled)
  - startTime: 1044
    title: Fixing Replica Set Controller
  - startTime: 1067
    title: Connectivity Issues (Curl Refused)
  - startTime: 1080
    title: Debugging Service Connectivity (NodePort)
  - startTime: 1720
    title: Testing Connectivity from Worker
  - startTime: 1941
    title: Checking CNI & Network Policies
  - startTime: 1988
    title: Identifying Network Policy Block
  - startTime: 2005
    title: Fixing Network Policy
  - startTime: 2031
    title: Connectivity Restored
  - startTime: 2471
    title: Challenge 1 Complete & Debrief
  - startTime: 2580
    title: Alistair Fixes Alex's Cluster (Challenge 2 Starts)
  - startTime: 2644
    title: Initial Checks on Slow Machine
  - startTime: 2724
    title: 'Debugging System Slowness (df, htop)'
  - startTime: 3028
    title: Checking Sysctl Parameters
  - startTime: 3301
    title: 'Hint: Traffic Control'
  - startTime: 3411
    title: Identifying Traffic Control Delays
  - startTime: 3479
    title: Fixing Traffic Control Delays
  - startTime: 3512
    title: 'Slowness Fixed, Kubectl Issues'
  - startTime: 3663
    title: Debugging Kubectl Command
  - startTime: 3693
    title: Identifying Kubectl Alias
  - startTime: 3727
    title: Fixing Kubectl Alias
  - startTime: 3796
    title: Pods Stuck Terminating / Worker Unhealthy
  - startTime: 3941
    title: Debugging Node/Kubelet Health
  - startTime: 4026
    title: App Pod Image Issue (v1 vs v2)
  - startTime: 4044
    title: Fixing App Deployment Image
  - startTime: 4078
    title: Application Fixed
  - startTime: 4082
    title: Challenge 2 Complete & Debrief
  - startTime: 4339
    title: Discussion & Reflections
  - startTime: 4471
    title: Thank You & Wrap-up
duration: 4621
guests:
  - alexsjones
  - waterdrips
resources:
  - title: Equinix Metal free credits link
    type: url
    category: other
  - title: Teleport
    type: url
    url: 'https://goteleport.com/'
    category: documentation
  - title: webinstall.dev
    type: url
    url: 'https://webinstall.dev/'
    category: other
---

