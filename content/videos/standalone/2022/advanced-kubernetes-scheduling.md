---
id: n3ub5yilclec48k398q64zi2
slug: advanced-kubernetes-scheduling
title: Advanced Kubernetes Scheduling
description: >-
  A deep dive into Kubernetes pod scheduling, from nodeName and node selectors
  through node and pod affinity, topology spread constraints, priority classes
  and preemption, plus alpha features like scheduling gates and dynamic resource
  allocation.
publishedAt: 2022-12-22T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - kubernetes
chapters:
  - startTime: 5
    title: Introduction and Topic Overview
  - startTime: 61
    title: What the Kubernetes Scheduler Does (Basics)
  - startTime: 251
    title: Bypassing the Scheduler (Manual Assignment)
  - startTime: 327
    title: Node Selector
  - startTime: 596
    title: 'Node Affinity (Required vs Preferred, Operators)'
  - startTime: 1008
    title: Pod Affinity and Anti-Affinity (Co-location and Repulsion)
  - startTime: 1346
    title: Three-Tier App Scenario (Affinity/Anti-Affinity in Practice)
  - startTime: 1828
    title: Priority Classes (Preemption)
  - startTime: 2060
    title: Topology Spread Constraints (Even Distribution)
  - startTime: 2570
    title: Pod Scheduling Readiness Gates (Alpha Feature)
  - startTime: 2772
    title: Dynamic Resource Allocation (Alpha Feature)
  - startTime: 3076
    title: Conclusion and Summary
duration: 3122
guests: []
resources:
  - title: 'Kubernetes Documentation: PriorityClass'
    type: url
    url: >-
      https://kubernetes.io/docs/concepts/scheduling-eviction/pod-priority-preemption/
    category: documentation
  - title: 'Kubernetes Documentation: Pod Scheduling Readiness'
    type: url
    url: >-
      https://kubernetes.io/docs/concepts/scheduling-eviction/pod-scheduling-readiness/
    category: documentation
  - title: 'Kubernetes Enhancement Proposal: Dynamic Resource Allocation'
    type: url
    url: >-
      https://github.com/kubernetes/enhancements/tree/master/keps/sig-node/3063-dynamic-resource-allocation
    category: documentation
  - title: 'Kubernetes Documentation: Topology Spread Constraints'
    type: url
    url: >-
      https://kubernetes.io/docs/concepts/scheduling-eviction/topology-spread-constraints/
    category: documentation
---

