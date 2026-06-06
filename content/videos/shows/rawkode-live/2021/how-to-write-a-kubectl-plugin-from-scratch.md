---
id: c1hn6xaw51c7lj22g4p4q93k
slug: how-to-write-a-kubectl-plugin-from-scratch
title: How to Write a kubectl Plugin from Scratch
description: >-
  Matt Turner joins to write a kubectl plugin in Bash that swaps kubectl's
  verb-noun ordering to noun-verb, then packages it for distribution through the
  Krew plugin manager with a crew.yaml manifest and GitHub releases.
publishedAt: 2021-01-13T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: rawkode-live
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
guests:
  - mt165
resources:
  - title: Kubernetes kubectl plugins documentation
    type: url
    url: 'https://kubernetes.io/docs/tasks/extend-kubectl/kubectl-plugins/'
    category: documentation
  - title: Krew kubectl plugin manager
    type: url
    url: 'https://krew.sigs.k8s.io/'
    category: other
  - title: Krew plugin index repository
    type: url
    url: 'https://github.com/kubernetes-sigs/krew-index'
    category: code
---

