---
id: lksy7dn1gol1tpatlye4oh6b
slug: introduction-to-vitess
title: Introduction to Vitess
description: >-
  Vitess maintainers Deepthi Sigireddi and Alkin Tezuysal from PlanetScale walk
  through the architecture (VTGate, VTTablet, topology), then deploy a sharded
  MySQL cluster on Kubernetes with the operator and connect WordPress.
whatYouWillLearn:
  - "Explain how VTGate routes queries using shard metadata from topology services"
  - "Deploy a sharded MySQL cluster on Kubernetes with the Vitess operator"
  - "Connect WordPress to Vitess then scale and reshard the cluster live"
publishedAt: 2021-02-26T17:00:00.000Z
type: live
category: tutorial
technologies:
  - vitess
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 45
    title: Introductions
  - startTime: 63
    title: Introduction
  - startTime: 97
    title: Guest Introductions
  - startTime: 233
    title: What is Vitess? (Project Overview)
  - startTime: 240
    title: What is Vitess?
  - startTime: 344
    title: Vitess Architecture Basics
  - startTime: 662
    title: Control Plane & Operational Features
  - startTime: 763
    title: Architecture Summary
  - startTime: 817
    title: Supported Databases & Sharding
  - startTime: 914
    title: Discussing Application Compatibility & Tools
  - startTime: 1080
    title: Installing Vitess
  - startTime: 1099
    title: Kubernetes Quick Start (Demo Setup)
  - startTime: 1500
    title: Creating MySQL Cluster
  - startTime: 1511
    title: Deploying the Cluster & Initial Look
  - startTime: 1891
    title: Connecting WordPress & Troubleshooting
  - startTime: 2340
    title: Deploying WordPress
  - startTime: 2738
    title: Successful WordPress Connection
  - startTime: 2763
    title: Application Compatibility Discussion Continued
  - startTime: 2918
    title: Exploring the Vitess UI
  - startTime: 2940
    title: Vitess UI
  - startTime: 3200
    title: Scaling Our MySQL Cluster
  - startTime: 3208
    title: Scaling Replicas & Testing Failover
  - startTime: 3692
    title: Failover Behavior Discussion
  - startTime: 3881
    title: Vitess-Specific SQL & Features
  - startTime: 3968
    title: 'Discussion: Multi-Keyspace / Logical Databases'
  - startTime: 4190
    title: 'Chatting about Sharding, Backup/Restore, & Misc.'
  - startTime: 4200
    title: Resharding (Advanced Feature Discussion)
  - startTime: 4435
    title: 'Discussion: Query Consolidation & Hot Rows'
  - startTime: 4532
    title: 'Discussion: Backup, Recovery & Online DDL'
  - startTime: 4880
    title: Community Resources
  - startTime: 4947
    title: Conclusion
duration: 4990
guests:
  - deepthi
  - askdba
resources:
  - title: Vitess Operator
    type: url
    url: 'https://github.com/planetscale/vitess-operator'
    category: code
  - title: Vitess Kubernetes Quick Start
    type: url
    url: 'https://vitess.io/docs/get-started/kubernetes/'
    category: documentation
  - title: Vitess Point-in-Time Recovery documentation
    type: url
    category: documentation
---
