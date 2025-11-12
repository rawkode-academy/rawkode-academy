---
id: hands-on-introduction-to-firecracker
slug: hands-on-introduction-to-firecracker
title: Hands-on Introduction to Firecracker
description: "In this episode, Radu and Grabriel will walk us through everything we need to know to get started with Firecracker.\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:50 - Introductions\n02:45 - What is Firecracker?\n06:30 - Installing Firecracker\n12:30 - Running a Firecracker microVM\n34:00 - Feature Demo: Snapshots\n45:00 - Getting Involved\n47:00 - Q&A\n\n\U0001F465 About the Guests\n\nRadu Weiss\n\n  I’m is a software development manager, and have been working on Firecracker since it got started. Many customers love using serverless compute offerings, and I in turn love helping build some of the components that power them.\n\n\n\U0001F426 https://twitter.com/raduweiss\n\U0001F9E9 https://github.com/raduweiss\n\n\n\nGabriel Ionescu\n\n  Embedded software engineer at heart with a focus on virtualization, currently working as an SDE on the Firecracker team. Present anywhere in the virtualization stack and serverless environment around Firecracker.\n\n\n\U0001F426 https://twitter.com/gc_plp\n\U0001F9E9 https://github.com/gc-plp\n\n\n\n\U0001F528 About the Technologies\n\nFirecracker\n\n\nFirecracker is an open source virtualization technology that is purpose-built for creating and managing secure, multi-tenant container and function-based services.\nFirecracker enables you to deploy workloads in lightweight virtual machines, called microVMs, which provide enhanced security and workload isolation over traditional VMs, while enabling the speed and resource efficiency of containers. Firecracker was developed at Amazon Web Services to improve the customer experience of services like AWS Lambda and AWS Fargate .\nFirecracker is a virtual machine monitor (VMM) that uses the Linux Kernel-based Virtual Machine (KVM) to create and manage microVMs. Firecracker has a minimalist design. It excludes unnecessary devices and guest functionality to reduce the memory footprint and attack surface area of each microVM. This improves security, decreases the startup time, and increases hardware utilization. Firecracker currently supports Intel CPUs, with AMD and Arm support in developer preview.\nFirecracker is used by/integrated with (in alphabetical order): appfleet , containerd via firecracker-containerd , Fly.io , Kata Containers , Koyeb , OpenNebula , Qovery , UniK , and Weave FireKube (via Weave Ignite ).\n\n\U0001F30F https://firecracker-microvm.github.io/\n\n\U0001F9E9 https://github.com/firecracker-microvm/firecracker\n\n##microVM ##Virtualisation"
publishedAt: 2021-05-25T17:00:00.000Z
technologies:
  - firecracker
show: rawkode-live
videoId: czi3j87pkjuupnifphnpqnor
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
---

