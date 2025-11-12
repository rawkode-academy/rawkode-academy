---
id: how-to-write-a-kubectl-plugin-from-scratch
slug: how-to-write-a-kubectl-plugin-from-scratch
title: How to Write a kubectl Plugin from Scratch
description: "In this episode, we build a kubectl plugin from scratch. We aim to solve the biggest problem in Kubernetes ... noun/verb ordering.\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:50 - Introductions\n02:00 - Context: Why is Kubernetes wrong\n06:20 - What is a kubectl plugin?\n32:00 - Publishing our plugin with Krew\n\n\U0001F465 About the Guests\n\nMatt Turner\n\n  Clouds , automation , Kubernetes (CKA) , Istio\n\n\n\U0001F426 https://twitter.com/mt165\n\U0001F9E9 https://github.com/mt165\n\U0001F30F https://mt165.co.uk/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-01-13T17:00:00.000Z
technologies: []
show: rawkode-live
videoId: c1hn6xaw51c7lj22g4p4q93k
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 57
    title: Introduction and Guest
  - startTime: 120
    title: 'Context: Why is Kubernetes wrong'
  - startTime: 140
    title: 'The Problem: `kubectl` Verb-Noun Ordering'
  - startTime: 270
    title: Demonstrating the Problem
  - startTime: 380
    title: What is a kubectl plugin?
  - startTime: 390
    title: '`kubectl` Plugin Mechanism Explained'
  - startTime: 480
    title: Building a Basic Bash Plugin ("Hello World")
  - startTime: 549
    title: Making the Plugin Executable & Adding to Path
  - startTime: 630
    title: Testing the Basic Plugin
  - startTime: 705
    title: Implementing Verb-Noun Swap Logic (Initial attempt)
  - startTime: 870
    title: Testing the Verb-Noun Swap (Local bash run)
  - startTime: 1080
    title: Discussing Plugin Limitations and Edge Cases
  - startTime: 1460
    title: Introducing Crew Plugin Manager
  - startTime: 1580
    title: Creating the Crew Manifest (`crew.yaml`)
  - startTime: 1920
    title: Publishing our plugin with Krew
  - startTime: 1950
    title: Preparing Git Repository for Crew Publishing (First release setup)
  - startTime: 2440
    title: Attempting Local Installation via Crew (First try with manifest)
  - startTime: 2520
    title: 'Debugging Crew Manifest and Installation Issues (alpha 2, 3, 4 attempts)'
  - startTime: 3290
    title: 'Debugging Argument Handling in Crew Context (alpha 5, 6, 7 attempts)'
  - startTime: 4660
    title: Successful Local Installation and Testing via Crew
  - startTime: 4710
    title: Discussing Crew Index Publishing & Future Work
  - startTime: 4790
    title: Conclusion
duration: 4894
---

