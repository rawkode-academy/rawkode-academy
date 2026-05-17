---
id: wm654x7yh3u93du0p8g2vfd3
slug: writing-a-kubernetes-controller
title: Writing a Kubernetes Controller
description: 'Suhail Patel joins Rawkode to build a Kubernetes mutating admission webhook in Go that rewrites pod image tags expressed as semver constraints into concrete versions, with TLS certs generated via CFSSL and the Kubernetes CSR API.'
publishedAt: 2021-02-10T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 61
    title: Introduction
  - startTime: 180
    title: What is a Kubernetes controller?
  - startTime: 199
    title: What is a Kubernetes Controller?
  - startTime: 269
    title: 'Discussion: Controllers in Kubernetes Core'
  - startTime: 330
    title: What are we going to build?
  - startTime: 336
    title: 'The Problem: Semantic Versioning in Image Tags'
  - startTime: 476
    title: 'Exploring Extension Points: Admission Controllers'
  - startTime: 540
    title: 'Admission Controllers: Webhooks Explained'
  - startTime: 738
    title: 'Webhooks: HTTP Handlers & JSON Patch'
  - startTime: 910
    title: 'Question: Controller vs Operator?'
  - startTime: 917
    title: 'Q&A: Controller vs. Operator'
  - startTime: 1100
    title: 'Question: Build from scratch or SDKs?'
  - startTime: 1103
    title: 'Q&A: Building from Scratch vs. SDKs'
  - startTime: 1248
    title: Building the Basic Go Webhook
  - startTime: 1260
    title: Building the boilerplate for our admission controller
  - startTime: 1503
    title: Processing the Admission Review Request
  - startTime: 1720
    title: Basic Webhook Code Walkthrough & Error Handling
  - startTime: 2520
    title: Building a container image
  - startTime: 2546
    title: 'Preparing for Deployment: Docker & TLS'
  - startTime: 2692
    title: Certificate Requirements
  - startTime: 2700
    title: Creating the Kubernetes manifests
  - startTime: 2880
    title: Generating the certificates
  - startTime: 2897
    title: Generating TLS Certificates with CFSSL
  - startTime: 3137
    title: Creating and Approving the Kubernetes CSR
  - startTime: 3305
    title: Debugging Certificate Approval Problems
  - startTime: 4800
    title: Creating our MutatingWebhook configuration
  - startTime: 4930
    title: Defining the Mutating Webhook Configuration
  - startTime: 5111
    title: 'Webhook Configuration: Rules, Policy, Client Config'
  - startTime: 5400
    title: Deploying the Webhook Application
  - startTime: 5640
    title: Deploying our admission controller
  - startTime: 5697
    title: Testing the Basic Mutation
  - startTime: 5760
    title: Modifying the Pod spec
  - startTime: 5949
    title: Implementing Image Mutation Logic
  - startTime: 6447
    title: Verifying Basic Image Mutation
  - startTime: 6540
    title: Resolving the semantic version constraint
  - startTime: 6579
    title: Adding Semantic Versioning Logic
  - startTime: 6605
    title: Introducing the Semver Library
  - startTime: 6677
    title: Implementing Semver Resolution Logic
  - startTime: 7148
    title: Testing and Debugging Semver Resolution
  - startTime: 7410
    title: Semantic Versioning Mutation Works!
  - startTime: 7435
    title: Next Steps & Conclusion
  - startTime: 7629
    title: Farewell
duration: 7705
guests:
  - suhail-patel
resources:
  - title: Kubernetes Admission Controllers documentation
    type: url
    url: https://kubernetes.io/docs/reference/access-authn-authz/admission-controllers/
    category: documentation
  - title: Dynamic Admission Control (mutating and validating webhooks)
    type: url
    url: https://kubernetes.io/docs/reference/access-authn-authz/extensible-admission-controllers/
    category: documentation
  - title: Cloudflare CFSSL
    type: url
    url: https://github.com/cloudflare/cfssl
    category: code
---

