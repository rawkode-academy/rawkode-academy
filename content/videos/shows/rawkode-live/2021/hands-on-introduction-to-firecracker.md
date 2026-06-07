---
id: czi3j87pkjuupnifphnpqnor
slug: hands-on-introduction-to-firecracker
title: Hands-on Introduction to Firecracker
description: >-
  Radu and Gabriel from AWS demo Firecracker from the ground up. They walk
  through firecracker and jailer binaries, booting a microVM over the REST API
  on a Unix socket, networking and device emulation, the Go SDK, plus a
  hands-on snapshotting walkthrough comparing full and diff snapshots.
whatYouWillLearn:
  - "Build and run Firecracker microVMs by downloading binaries and starting VMs through the REST API socket."
  - "Explore Firecracker internals like one-process-per-VM architecture, jailer separation, and device emulation for networking."
  - "Compare full and dirty-page snapshots by capturing, restoring, and validating VM state during the demo."
publishedAt: 2021-05-25T17:00:00.000Z
type: live
category: tutorial
technologies:
  - firecracker
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 82
    title: Introducing Firecracker and Guests
  - startTime: 165
    title: What is Firecracker?
  - startTime: 166
    title: What is Firecracker? (The Elevator Pitch)
  - startTime: 240
    title: Why Firecracker is Fast & Minimal Emulation
  - startTime: 318
    title: Firecracker Use Cases
  - startTime: 390
    title: Installing Firecracker
  - startTime: 398
    title: Preparing for the Hands-on Demo
  - startTime: 428
    title: 'Hands-on: Getting Started & Downloading Binaries'
  - startTime: 532
    title: Understanding Firecracker and Jailer Binaries
  - startTime: 614
    title: 'Hands-on: Starting Firecracker & API Socket'
  - startTime: 750
    title: Running a Firecracker microVM
  - startTime: 851
    title: 'Firecracker Architecture: One Process Per VM'
  - startTime: 947
    title: 'Hands-on: Downloading Demo VM Images'
  - startTime: 1017
    title: Building Custom VM Images
  - startTime: 1120
    title: 'Hands-on: Configuring & Starting the VM via API'
  - startTime: 1322
    title: Viewing the VM Console
  - startTime: 1377
    title: Logging into the Demo VM
  - startTime: 1422
    title: Networking & Device Emulation Discussion
  - startTime: 1875
    title: Firecracker API (Swagger) and Firectl Tool
  - startTime: 2040
    title: 'Feature Demo: Snapshots'
  - startTime: 2047
    title: Transition to Snapshotting Demo
  - startTime: 2085
    title: Snapshotting Demo Introduction
  - startTime: 2278
    title: 'Snapshotting Demo: Initial VM Run'
  - startTime: 2340
    title: 'Snapshotting Demo: Modifying VM State'
  - startTime: 2378
    title: 'Snapshotting Demo: Saving the Snapshot'
  - startTime: 2457
    title: Explaining Snapshot Types (Full vs. Dirty Page)
  - startTime: 2525
    title: 'Snapshotting Demo: Comparing Snapshot Sizes'
  - startTime: 2580
    title: 'Snapshotting Demo: Restoring the VM'
  - startTime: 2667
    title: 'Snapshotting Demo: Verifying Restored State'
  - startTime: 2700
    title: Getting Involved
  - startTime: 2706
    title: Post-Demo Discussion
  - startTime: 2761
    title: Contribution & Higher-Level Integrations
  - startTime: 2820
    title: Q&A
  - startTime: 2867
    title: Audience Q&A
  - startTime: 3672
    title: Conclusion & Thank You
duration: 3735
guests:
  - raduweiss
  - gc-plp
resources:
  - title: Firecracker Quick Start Guide
    type: url
    category: documentation
    url: https://github.com/firecracker-microvm/firecracker/blob/main/docs/getting-started.md
  - title: Firecracker Swagger API specification
    type: url
    category: documentation
    url: https://github.com/firecracker-microvm/firecracker/blob/main/src/firecracker/swagger/firecracker.yaml
  - title: Firecracker Go SDK
    type: url
    category: code
    url: https://github.com/firecracker-microvm/firecracker-go-sdk
  - title: Weave Ignite
    type: url
    category: code
    url: https://github.com/weaveworks/ignite
---
