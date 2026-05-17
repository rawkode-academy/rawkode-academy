---
id: dlz3w6ojomalhbj1j2anqgxd
slug: introduction-to-falco
title: Introduction to Falco
description: >-
  Falco, the open-source cloud-native runtime security project, is the de facto
  Kubernetes threat detection engine. Falco was created by Sysdig in 2016 and is
  the first runtime security project to join CNCF as an incubation-level
  project.
publishedAt: 2020-10-30T17:00:00.000Z
type: live
category: tutorial
technologies:
  - falco
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 90
    title: Introductions
  - startTime: 157
    title: Guest Introductions (Lorenzo & Leo)
  - startTime: 340
    title: What is Falco?
  - startTime: 357
    title: What is Falco? Use Cases
  - startTime: 482
    title: Falco's Place in the Security Landscape (Detection)
  - startTime: 728
    title: Demo Setup & Falco Prerequisites (Kernel/OS)
  - startTime: 760
    title: Linux requirements for Falco
  - startTime: 1050
    title: Installing Falco
  - startTime: 1059
    title: Installing Falco on the Host (Apt)
  - startTime: 1268
    title: Verifying Falco Installation and Initial Logs
  - startTime: 1540
    title: Making Falco angry (Breaking a Falco rule)
  - startTime: 1545
    title: Triggering a Syscall Rule Manually (chmod)
  - startTime: 1649
    title: Triggering a Syscall Rule in a Container (touch)
  - startTime: 1802
    title: Understanding Dropped Events
  - startTime: 1860
    title: Falco default rules
  - startTime: 1905
    title: Recap Syscall Detection
  - startTime: 1920
    title: 'Exploring Default Falco Rules (YAML, Macros, Lists)'
  - startTime: 2125
    title: Analyzing a Specific Default Rule (Privileged Container)
  - startTime: 2276
    title: 'Future of Rules: External Loading (OPA)'
  - startTime: 2542
    title: 'Falco Output Options (Sidekick, gRPC)'
  - startTime: 2629
    title: Kubernetes Audit Log Integration Setup
  - startTime: 2630
    title: Manually sending Kubernetes events to Falco web-hook receiver
  - startTime: 2644
    title: Simulating a Kubernetes Audit Event
  - startTime: 2884
    title: Analyzing a Kubernetes Audit Rule (Anonymous User)
  - startTime: 2920
    title: 'Recap: Kubernetes Audit Integration (Webhook)'
  - startTime: 2940
    title: Adding Kubernetes Auditing to Falco
  - startTime: 3359
    title: Troubleshooting Kube API Server Config
  - startTime: 3713
    title: Kube API Server Restored
  - startTime: 3720
    title: Triggering Falco from Kubernetes (Storing "secret" in a ConfigMap)
  - startTime: 3733
    title: Confirming Kube Audit Events in Falco Logs
  - startTime: 3761
    title: Triggering a Kube Audit Rule (Secret in ConfigMap)
  - startTime: 4071
    title: Audit Log Entry Found
  - startTime: 4200
    title: What is Falco Evolution repository?
  - startTime: 4205
    title: Falco Evolution Repository (Examples)
  - startTime: 4290
    title: Falco pdig (Userspace Falco)
  - startTime: 4299
    title: User Space Driver Efforts (Pdig/Ptrace)
  - startTime: 4570
    title: 'Question: Is there a GUI?'
  - startTime: 4572
    title: GUI Options (Commercial Products)
  - startTime: 4639
    title: Falco's CNCF Status and Community
  - startTime: 4730
    title: Conclusion and Thank You
duration: 4850
guests:
  - leo-di-donato
  - lorenzo-fontana
resources:
  - title: Falco Sidekick
    category: code
    evidence_quote: >-
      we have a software in the Falco security organization which is called
      Falco Sidekick that, you know, for example, can take, the Falco logs and
      send them to Slack or send them to AWS SNS or these kind things.
    confidence: medium
---

