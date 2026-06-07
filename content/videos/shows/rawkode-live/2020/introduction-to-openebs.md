---
id: t9v6vfqfjcxjfohd2vrxpeet
slug: introduction-to-openebs
title: Introduction to OpenEBS
description: >-
  Paul Burt and Jeffry Molanus join Rawkode for OpenEBS and its new Mayastor
  engine. They cover Container Attached Storage, DPDK/SPDK, huge pages, and
  NVMe-oF replication via the Nexus, then deploy Mayastor on a Kubernetes
  cluster and benchmark it with fio.
whatYouWillLearn:
  - "Understand how OpenEBS implements Container Attached Storage for Kubernetes by managing storage controllers in application pods."
  - "Explore Mayastor's architecture using SPDK, DPDK, huge pages, and NVMe-oF replication through Nexus and replicas."
  - "Deploy and validate an OpenEBS MayaStore cluster by configuring pools, creating PVCs, and running fio storage performance tests."
publishedAt: 2020-10-21T17:00:00.000Z
type: live
category: tutorial
technologies:
  - openebs
  - kubernetes
  - nats
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 130
    title: Introductions
  - startTime: 133
    title: Introduction and Guest Introductions
  - startTime: 215
    title: Slides - Introduction to OpenEBS
  - startTime: 240
    title: What is OpenEBS and Container Attached Storage?
  - startTime: 320
    title: Industry Trends Driving Cloud-Native Storage
  - startTime: 536
    title: High Performance Storage & User Space Development
  - startTime: 632
    title: Introducing MayaStore - OpenEBS's New Engine
  - startTime: 647
    title: OpenEBS Adoption and Use Cases (Local/Replicated PV)
  - startTime: 773
    title: 'MayaStore Goals: Rethinking Storage in User Space'
  - startTime: 967
    title: 'Deep Dive: DPDK and SPDK Explained'
  - startTime: 975
    title: >-
      What is DPDK (Data Plane Development Kit) and SPDK (Storage Performance
      Development Kit)
  - startTime: 1350
    title: My summary of what we've covered
  - startTime: 1860
    title: Why Huge Pages / Enabling Huge Pages on Linux
  - startTime: 2320
    title: Deploying OpenEBS with Mayastor
  - startTime: 2640
    title: Fixing my unhealthy cluster
  - startTime: 2850
    title: Adding the nvme kernel modules
  - startTime: 3150
    title: Configuring Mayastor
  - startTime: 3570
    title: Requesting a PersistentVolumeClaim
  - startTime: 4290
    title: Deploying fio to run some benchmarks
  - startTime: 4680
    title: Closing thoughts
  - startTime: 4950
    title: Summary of OpenEBS & MayaStore Concepts
  - startTime: 5078
    title: MayaStore Maturity and Production Readiness
  - startTime: 5170
    title: 'MayaStore Architecture & Replication (Pools, Replicas, Nexus)'
  - startTime: 5474
    title: 'Live Demo: Cluster Setup and Prerequisites (Huge Pages)'
  - startTime: 5929
    title: 'Live Demo: Troubleshooting Kubernetes Cluster'
  - startTime: 6603
    title: 'Live Demo: Installing OpenEBS MayaStore Components'
  - startTime: 6681
    title: 'Live Demo: Verifying Installation (MSN, NATS)'
  - startTime: 6786
    title: 'Live Demo: Configuring MayaStore Storage Pools'
  - startTime: 7091
    title: 'Live Demo: Creating StorageClass and Persistent Volume Claim (PVC)'
  - startTime: 7450
    title: 'Live Demo: Examining the MSVolume Architecture (Nexus, Replicas)'
  - startTime: 7895
    title: 'Live Demo: Testing the Volume with FIO'
  - startTime: 8227
    title: Conclusion and Future Outlook
duration: 4955
guests:
  - kmova
  - gila
resources:
  - title: MayaStore alpha features documentation
    type: url
    category: documentation
  - title: MayaStore quick start guide
    type: url
    category: documentation
  - title: Nixery.dev
    type: url
    url: 'https://nixery.dev'
    category: demos
---
