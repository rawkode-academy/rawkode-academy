---
id: introduction-to-the-operatorsdk
slug: introduction-to-the-operatorsdk
title: Introduction to the OperatorSDK
description: "Want to try Equinix Metal? Use the code \"rawkode-live\" for $50 of credit, which is roughly 100 hours of compute on our smaller instances. Sign up at https://equinixmetal.com\n\n---\n\nThis Operator SDK is a component of the Operator Framework, an open source toolkit to manage Kubernetes native applications, called Operators, in an effective, automated, and scalable way.\n\nThe Operator SDK provides the tools to build, test, and package Operators. Initially, the SDK facilitates the marriage of an application’s business logic (for example, how to scale, upgrade, or backup) with the Kubernetes API to execute those operations. Over time, the SDK can allow engineers to make applications smarter and have the user experience of cloud services. Leading practices and code patterns that are shared across Operators are included in the SDK to help prevent reinventing the wheel.\n\nThe Operator SDK is a framework that uses the controller-runtime library to make writing operators easier by providing:\n\n- High level APIs and abstractions to write the operational logic more intuitively\n- Tools for scaffolding and code generation to bootstrap a new project fast\n- Extensions to cover common Operator use cases\n\n\n\U0001F570 Timeline\n\n\n00:00 - Holding\n00:30 - Introductions\n03:20 - What is an operator / What is Operator SDK\n06:15 - Creating a new operator\n13:50 - Adding fields to our custom resource definition\n15:40 - Adding our business logic / Reconcile\n24:00 - Deploying / running our operator on a Kubernetes cluster\n\n\n\U0001F30E Resources\n\nDennis Kelly - https://twitter.com/DennoVonDiesel\n\nOperator Framework - https://operatorframework.io/"
publishedAt: 2020-12-09T17:00:00.000Z
technologies:
  - operatorsdk
show: rawkode-live
videoId: x7i5glnt55z23vrd3th0wgbb
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
---

