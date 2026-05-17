---
id: wijy1wsp03lfq5mjrhjvtwm0
slug: making-kubernetes-network-policies-effortless-with-otterize
title: Making Kubernetes Network Policies Effortless with Otterize
description: >-
  Otterize replaces hand-written Kubernetes NetworkPolicies with intent-based
  access control: developers declare which services they call in ClientIntents
  CRs, and the operator generates the policies. Demoed on Weaveworks Sock Shop,
  with Otterize Cloud's access graph.
publishedAt: 2023-11-29T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - otterize
  - kubernetes
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 40
    title: How Otterize Works (Not a Service Mesh)
  - startTime: 74
    title: What is IBAC
  - startTime: 84
    title: Explaining Intent Based Access Control (iBack) in Detail
  - startTime: 123
    title: The Problem with Traditional Security Policy Management
  - startTime: 165
    title: iBack and the Concept of Intent Files
  - startTime: 217
    title: L7 Awareness and Kafka Intents
  - startTime: 259
    title: 'Demo Overview: Installation, Intents, Modes, and Cloud'
  - startTime: 293
    title: Installing Otterize (Open Source Components)
  - startTime: 294
    title: Install IBAC
  - startTime: 310
    title: 'Key Otterize Components (Intents Operator, Network Mapper)'
  - startTime: 376
    title: Introducing the Demo Application (Sockshop)
  - startTime: 427
    title: Applying a Client Intent (Front-end to User)
  - startTime: 489
    title: Inspecting the Generated Kubernetes Network Policy
  - startTime: 538
    title: Testing the Initial Policy (Login Works)
  - startTime: 562
    title: Protecting a Service (Implementing Default Deny)
  - startTime: 604
    title: Testing with Protected Service and Intent (Login Still Works)
  - startTime: 618
    title: Changing Intents and Demonstrating Access Denial
  - startTime: 679
    title: Restoring Intent and Access
  - startTime: 712
    title: Protecting Another Service Without Intent (Catalog)
  - startTime: 764
    title: Summary of Two-Phase Adoption Strategy
  - startTime: 795
    title: Introducing Otterize Cloud
  - startTime: 804
    title: Use Authorized Cloud
  - startTime: 825
    title: Connecting Your Cluster to Otterize Cloud
  - startTime: 931
    title: Demo
  - startTime: 932
    title: Visualizing Access with the Otterize Cloud Access Graph
  - startTime: 964
    title: Discovering Real-Time Communication with Network Mapper
  - startTime: 1048
    title: Updating Intents Based on Discovered Traffic
  - startTime: 1101
    title: Visualizing Updated Policies in the Cloud Graph
  - startTime: 1133
    title: Using the Otterize CLI for Network Map Export
  - startTime: 1185
    title: Applying Full Discovered Intents YAML
  - startTime: 1231
    title: Outro
  - startTime: 1232
    title: Conclusion and Next Steps
duration: 1271
guests: []
resources:
  - title: Otterize iBack page
    type: url
    url: 'https://docs.otterize.com/'
    category: documentation
  - title: Otterize HelmChart repository
    type: url
    url: 'https://github.com/otterize/helm-charts'
    category: code
  - title: Weaveworks Sockshop demo
    type: url
    url: 'https://github.com/microservices-demo/microservices-demo'
    category: demos
---

