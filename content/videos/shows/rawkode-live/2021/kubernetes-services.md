---
id: t6z7vbrzz03zq1xvwlugnyoz
slug: kubernetes-services
title: Kubernetes Services
description: >-
  Anaïs Urlichs and Philipp Strube join David to break down Kubernetes Services:
  ClusterIP, NodePort, port versus targetPort, selectors and endpoints,
  DNS-based service discovery, and load balancing across pods.
whatYouWillLearn:
  - "Distinguish ClusterIP and NodePort services by how clients reach pods."
  - "Trace service selectors to endpoints, then watch readiness probes change traffic."
  - "Use port and targetPort, plus named ports, to map requests correctly."
publishedAt: 2021-01-13T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 65
    title: Introduction
  - startTime: 100
    title: Speaker Introductions & Motivation
  - startTime: 238
    title: Setting up the Example (YAML)
  - startTime: 360
    title: Multi container pods
  - startTime: 362
    title: Networking within a Pod
  - startTime: 469
    title: Understanding Pod Port Conflicts
  - startTime: 657
    title: Sidecar Pattern
  - startTime: 821
    title: Networking Between Pods and the Need for Services
  - startTime: 870
    title: What are the 3 types of service?
  - startTime: 878
    title: Introduction to Kubernetes Services
  - startTime: 905
    title: 'Service Role: Discovery and Load Balancing'
  - startTime: 968
    title: Kubernetes Service Types Overview
  - startTime: 1005
    title: ClusterIP services
  - startTime: 1058
    title: Defining a ClusterIP Service
  - startTime: 1089
    title: Service Selectors and Labels
  - startTime: 1231
    title: Inspecting Service Endpoints
  - startTime: 1320
    title: Readiness Probes and Service Endpoints
  - startTime: 1456
    title: 'Labels in Deployments, ReplicaSets, and Pods'
  - startTime: 1680
    title: NodePort services
  - startTime: 1750
    title: 'Service Port Configuration (`port`, `targetPort`)'
  - startTime: 1860
    title: NodePort Service Type
  - startTime: 1987
    title: Use Cases for Service Types
  - startTime: 2150
    title: Exposing Multiple Ports in a Service
  - startTime: 2309
    title: Demonstrating ClusterIP Service Discovery & Load Balancing
  - startTime: 2414
    title: Attempting NodePort Demonstration
  - startTime: 2560
    title: Detailed Explanation of `port` vs `targetPort`
  - startTime: 2709
    title: Named Ports
  - startTime: 2810
    title: Environment Variables for Service Discovery
  - startTime: 2868
    title: Successful NodePort Demonstration
  - startTime: 2954
    title: Summary and Q&A
  - startTime: 3104
    title: Conclusion
duration: 3154
guests:
  - anaisurlichs
  - pst
resources:
  - title: OpenFaaS nodeinfo
    type: url
    category: demos
---
