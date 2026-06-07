---
id: wpypzqdx7xd2yns85cx0daty
slug: introduction-to-kyverno
title: Introduction to Kyverno
description: >-
  Jim Bugwadia and Shuting Zhao explain how Kyverno brings Kubernetes-native
  policy management via validate, mutate, and generate rules. Covers the
  admission controller, policy reports, comparisons with PodSecurityPolicies and
  OPA Gatekeeper, and hands-on policy demos.
whatYouWillLearn:
  - "How Kyverno enforces Kubernetes policies through admission controller requests."
  - "How validate, mutate, and generate rules shape cluster behavior."
  - "How policy reports and audit mode surface policy violations."
publishedAt: 2021-02-19T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kyverno
  - kubernetes
  - opa
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 15
    title: Introductions
  - startTime: 50
    title: Guest Introductions
  - startTime: 90
    title: What is Kyverno?
  - startTime: 95
    title: What is Kyverno? Problem it Solves
  - startTime: 116
    title: Kyverno's Kubernetes Native Design
  - startTime: 182
    title: The Need for Policies in Kubernetes
  - startTime: 247
    title: 'Policy Capabilities (Validate, Mutate, Generate)'
  - startTime: 324
    title: Policy Language Comparison
  - startTime: 375
    title: Kyverno Policy Structure
  - startTime: 464
    title: 'How Kyverno Runs (Admission Controller, Policy Reports)'
  - startTime: 549
    title: Discussion & Q&A Start
  - startTime: 560
    title: Kyverno vs. PodSecurityPolicies
  - startTime: 918
    title: 'Getting Started: Installation Demo'
  - startTime: 920
    title: Installing Kyverno
  - startTime: 1108
    title: 'Demo: Basic Validation Policy (Require Labels)'
  - startTime: 1110
    title: Applying our first policy
  - startTime: 1388
    title: Common Policy Use Cases & Policy Library
  - startTime: 1480
    title: Can we all use the same prepackaged policies?
  - startTime: 1795
    title: Applying the PodSecurityPolicy policies
  - startTime: 1894
    title: 'Q&A: Policy Application Scope & AutoGen'
  - startTime: 2090
    title: Kubectl Explain for Kyverno CRDs
  - startTime: 2168
    title: 'Demo: Testing Policies with "Bad Pods"'
  - startTime: 2396
    title: Advanced Policy Syntax (Anchors)
  - startTime: 2400
    title: Writing Kyverno policies
  - startTime: 2553
    title: 'Advanced Policy Use Cases (Generate, Mutate)'
  - startTime: 2660
    title: Policy Organization & Best Practices
  - startTime: 2872
    title: Excluding Resources/Namespaces
  - startTime: 2930
    title: Audit reports
  - startTime: 2933
    title: Audit Mode & Policy Reports
  - startTime: 3210
    title: Variables and External Data Sources
  - startTime: 3411
    title: 'Generate Policies: Automation Demo & Examples'
  - startTime: 3440
    title: Generating policies
  - startTime: 3979
    title: Synchronizing Generated Resources
  - startTime: 4080
    title: Variables
  - startTime: 4200
    title: External data sources (API Server)
  - startTime: 4383
    title: Matching Policies by User/Service Account
  - startTime: 4471
    title: 'Q&A: Policy Reports & Audit Logs / Falco'
  - startTime: 4578
    title: Conclusion & Community Resources
duration: 4695
guests:
  - jimbugwadia
  - realshuting
resources:
  - title: Kubernetes Pod Security Standards documentation
    type: url
    category: documentation
    url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/'
  - title: Bishop Fox Bad Pods repository
    type: url
    category: demos
    url: 'https://github.com/BishopFox/badPods'
  - title: kyverno/policies repository
    type: url
    category: code
    url: 'https://github.com/kyverno/policies'
  - title: OPA Gatekeeper
    type: url
    category: code
    url: 'https://github.com/open-policy-agent/gatekeeper'
  - title: kubectl neat
    type: url
    category: other
    url: 'https://github.com/itaysk/kubectl-neat'
---
