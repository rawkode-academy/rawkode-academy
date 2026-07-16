---
id: 02b0aa5bbec82f52066ff235
slug: hands-on-introduction-to-kueue
title: Hands-on Introduction to Kueue
tagline: Kubernetes-native job queueing, hands-on
subtitle: A hands-on introduction to Kueue with Amy Chen.
description: |-
  Join Amy Chen for a hands-on introduction to **Kueue**, the Kubernetes-native job queueing system for batch, HPC, and AI/ML workloads.

  Kubernetes knows how to schedule Pods, but running large collections of resource-intensive jobs introduces another set of challenges. Which workloads should start first? How should limited GPUs be shared between teams? What happens when demand exceeds cluster capacity?

  Kueue adds workload admission, queueing, quotas, priorities, fair sharing, and preemption without replacing the Kubernetes scheduler.

  In this live session, we explore:

  * What Kueue is and where it fits in the Kubernetes scheduling stack
  * The difference between scheduling and workload admission
  * LocalQueues, ClusterQueues, ResourceFlavors, and Workloads
  * Managing CPU, memory, GPU, and other resource quotas
  * Sharing cluster capacity across teams and namespaces
  * Priorities, fair sharing, borrowing, and preemption
  * Installing and configuring Kueue
  * Submitting and observing queued jobs
  * Practical considerations for batch, HPC, and AI/ML platforms
  * Live demonstrations and audience questions

  Amy will take us beyond the architecture and show how Kueue behaves inside a real Kubernetes environment.

  Whether you operate shared GPU clusters, machine-learning platforms, research infrastructure, CI systems, or large-scale batch workloads, this session will provide a practical foundation for managing queued work with Kubernetes.

  🔗 Learn more:

  * Rawkode Academy
  * Kueue documentation
  * Kubernetes SIG Scheduling
  * Kueue on GitHub

  Subscribe for more hands-on sessions covering Kubernetes, cloud native infrastructure, AI platforms, HPC, Rust, WebAssembly, and distributed systems.

  #Kueue #Kubernetes #CloudNative #MachineLearning #HPC #GPUs #BatchProcessing #PlatformEngineering #RawkodeAcademy
whatYouWillLearn:
  - "Understand how Kueue queues and admits Kubernetes workloads."
  - "Configure LocalQueues and ClusterQueues to manage shared resource quotas."
  - "See how Kueue supports batch and AI/ML workloads without replacing the Kubernetes scheduler."
terms:
  - Kueue
  - Kubernetes job queueing
  - ClusterQueue
  - LocalQueue
  - ResourceFlavor
publishedAt: 2026-07-17T16:00:00.000Z
type: live
category: tutorial
technologies:
  - kueue
  - kubernetes
show: rawkode-live
duration: 3600
guests:
  - amy
---
