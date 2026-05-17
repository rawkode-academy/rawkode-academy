---
id: x7i5glnt55z23vrd3th0wgbb
slug: introduction-to-the-operatorsdk
title: Introduction to the OperatorSDK
description: >-
  Dennis Kelly walks through the Operator SDK by building a Go-based "add"
  operator: scaffolding a project, defining a custom resource, writing the
  reconciler with controller-runtime, generating CRDs and RBAC, and deploying
  it to a Kubernetes cluster.
publishedAt: 2020-12-09T17:00:00.000Z
type: live
category: tutorial
technologies:
  - operatorframework
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding
  - startTime: 30
    title: Introductions
  - startTime: 72
    title: Introduction & Sponsor
  - startTime: 107
    title: 'Guest Introduction: Dennis Kelly'
  - startTime: 200
    title: What is an operator / What is Operator SDK
  - startTime: 209
    title: What is a Kubernetes Operator?
  - startTime: 273
    title: What is the OperatorSDK?
  - startTime: 308
    title: 'Project Goal: Building an "Add" Operator'
  - startTime: 367
    title: Prerequisites & Initializing the Project
  - startTime: 375
    title: Creating a new operator
  - startTime: 480
    title: Creating the API (Custom Resource Definition)
  - startTime: 665
    title: Defining the Custom Resource (CR) Schema (`_types.go`)
  - startTime: 830
    title: Adding fields to our custom resource definition
  - startTime: 936
    title: Implementing the Controller Logic (`_controller.go`)
  - startTime: 940
    title: Adding our business logic / Reconcile
  - startTime: 1315
    title: 'Generating Kubernetes Manifests (CRD, RBAC)'
  - startTime: 1440
    title: Deploying / running our operator on a Kubernetes cluster
  - startTime: 1565
    title: Creating a Custom Resource Instance
  - startTime: 1599
    title: Verifying the Result (Viewing CR Status)
  - startTime: 1765
    title: Demonstrating CR Update & Reconciliation
  - startTime: 1851
    title: Further Discussion & Use Cases
  - startTime: 2266
    title: Discussing CRD Schema and Validation
  - startTime: 2679
    title: Future Plans for the Project & Community
  - startTime: 2819
    title: Conclusion
duration: 2868
guests:
  - dennis-kelly
resources:
  - title: add operator repository
    type: url
    category: code
---

