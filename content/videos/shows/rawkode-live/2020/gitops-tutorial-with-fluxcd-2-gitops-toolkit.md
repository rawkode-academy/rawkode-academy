---
id: gitops-tutorial-with-fluxcd-2-gitops-toolkit
slug: gitops-tutorial-with-fluxcd-2-gitops-toolkit
title: GitOps Tutorial with FluxCD 2 (GitOps Toolkit)
description: "GitOps is a way to do Kubernetes cluster management and application delivery.  It works by using Git as a single source of truth for declarative infrastructure and applications. With GitOps, the use of software agents can alert on any divergence between Git with what's running in a cluster, and if there's a difference, Kubernetes reconcilers automatically update or rollback the cluster depending on the case. With Git at the center of your delivery pipelines, developers use familiar tools to make pull requests to accelerate and simplify both application deployments and operations tasks to Kubernetes.\n\nThe GitOps Toolkit is a set of composable APIs and specialized tools that can be used to build a Continuous Delivery platform on top of Kubernetes.\n\nThese tools are build with Kubernetes controller-runtime libraries, and they can be dynamically configured with Kubernetes custom resources either by cluster admins or by other automated tools. The GitOps Toolkit components interact with each other via Kubernetes events and are responsible for the reconciliation of their designated API objects.\n\n\n\U0001F570 Timeline\n\n\n00:00 - Holding Screen\n01:25 - Introductions\n02:00 - What is GitOps / GitOps Toolkit?\n05:00 - Should I use Flux v1 or GitOps Toolkit?\n07:45 - Bootstrapping GitOps Toolkit\n15:00 - What are the GitOps Toolkit components?\n17:40 - GitOps Toolkit CRDs\n21:00 - Suspending reconciliation\n23:30 - Deploying our first workload\n27:10 - Questions\n34:30 - Add another GitRepository\n43:30 - Dependencies and health-checks\n59:20 - Deploying Helm charts\n1:09:00 - Final questions\n\n\n\n\U0001F30E Resources\n\n\nStefan Prodan - https://twitter.com/stefanprodan\nGitOps Toolkit Soruce - https://github.com/fluxcd/toolkit\nGitOps Toolkit Docs - https://toolkit.fluxcd.io\nWalkthrough - https://gist.github.com/stefanprodan/1f5e0b31303a95885221e5c7733fc639"
publishedAt: 2020-10-13T17:00:00.000Z
technologies:
  - fluxcd
show: rawkode-live
videoId: fhspicv0ccs7sce6vc047vt3
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 85
    title: Introductions
  - startTime: 91
    title: Introduction
  - startTime: 120
    title: What is GitOps / GitOps Toolkit?
  - startTime: 141
    title: What is GitOps?
  - startTime: 180
    title: Introduction to Flux v1
  - startTime: 250
    title: GitOps Toolkit and Flux v2 Explained
  - startTime: 300
    title: Should I use Flux v1 or GitOps Toolkit?
  - startTime: 303
    title: Status of GitOps Toolkit (Feature Parity & Roadmap)
  - startTime: 465
    title: Bootstrapping GitOps Toolkit
  - startTime: 470
    title: 'Demo: Setting up the GitOps Toolkit'
  - startTime: 521
    title: Explanation of `gotk bootstrap` Command
  - startTime: 737
    title: Running the Bootstrap Command
  - startTime: 900
    title: What are the GitOps Toolkit components?
  - startTime: 905
    title: Overview of GitOps Toolkit Controllers
  - startTime: 979
    title: Webhooks and Notifications
  - startTime: 1060
    title: GitOps Toolkit CRDs
  - startTime: 1127
    title: Source and Customization Reconciliation Intervals
  - startTime: 1260
    title: Suspending reconciliation
  - startTime: 1297
    title: Suspending and Resuming Customizations
  - startTime: 1370
    title: 'Demo: Suspending a Customization'
  - startTime: 1405
    title: 'Demo: Resuming a Customization'
  - startTime: 1410
    title: Deploying our first workload
  - startTime: 1431
    title: Deploying an Application via GitOps
  - startTime: 1532
    title: 'Demo: Reconciling Changes'
  - startTime: 1585
    title: Verifying Application Deployment
  - startTime: 1630
    title: Questions
  - startTime: 1648
    title: Structuring the Git Repository for GitOps
  - startTime: 1901
    title: 'Q&A: Using Toolkit Without Customize / Custom Reconcilers'
  - startTime: 2019
    title: 'Q&A: Subversion Support'
  - startTime: 2070
    title: Add another GitRepository
  - startTime: 2354
    title: Creating the GitRepository CR for the Second Repo
  - startTime: 2610
    title: Dependencies and health-checks
  - startTime: 3560
    title: Deploying Helm charts
  - startTime: 3617
    title: Adding a Helm Repository Source
  - startTime: 3669
    title: Creating a Helm Release (Contour Example)
  - startTime: 3789
    title: Customizing Helm Charts with Values
  - startTime: 3896
    title: 'Demo: Applying the Helm Release'
  - startTime: 3919
    title: Verifying Helm Deployment
  - startTime: 3950
    title: 'Advanced Helm Features (Delegation, Tests, Rollback)'
  - startTime: 4027
    title: Monitoring the GitOps Toolkit (Prometheus/Grafana)
  - startTime: 4140
    title: Final questions
  - startTime: 4279
    title: 'Q&A: GitOps Toolkit vs. Rancher Fleet (Multi-Cluster Management)'
  - startTime: 4449
    title: Multi-Cluster Addons Use Case
  - startTime: 4506
    title: Summary and Conclusion
duration: 4575
---

