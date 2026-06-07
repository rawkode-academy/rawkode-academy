---
id: i3y48lfgt09qvoupcis4dkov
slug: crossplane-in-action
title: Crossplane in Action
description: >-
  Viktor Farcic walks through Crossplane as a control plane for everything,
  contrasts it with Terraform and Pulumi, then live-demos provisioning a GKE
  cluster, building composite resources, and watching drift detection rebuild a
  deleted node group.
whatYouWillLearn:
  - "Understand how Crossplane works as an infrastructure control plane and differs from Terraform or Pulumi."
  - "Apply Crossplane GKE cluster YAML as Kubernetes custom resources, then observe managed state with kubectl, logs, and metrics."
  - "Build reusable composite resources to package platform patterns, then validate platform consistency with Crossplane drift correction."
publishedAt: 2021-09-09T17:00:00.000Z
type: live
category: tutorial
technologies:
  - crossplane
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 54
    title: Welcome and Introduction
  - startTime: 67
    title: Channel Housekeeping
  - startTime: 101
    title: 'Introducing the Guest: Victor Farcic'
  - startTime: 224
    title: What is Crossplane?
  - startTime: 399
    title: Crossplane vs. Terraform/Pulumi (The Role of the Control Plane)
  - startTime: 656
    title: Live Demo - Simple Resource (GKE Cluster)
  - startTime: 862
    title: Introducing Composite Resources (XRs/XRDs)
  - startTime: 931
    title: Live Demo - Composite Kubernetes Cluster
  - startTime: 1130
    title: 'Anatomy of a Composition (Mapping Parameters, Provider Complexity)'
  - startTime: 1492
    title: 'Platform Building with Composites (Abstraction, Consistency)'
  - startTime: 1732
    title: 'Q&A: Bare Metal, Validations, Conditionals'
  - startTime: 1888
    title: Live Demo - Drift Detection (Deleting Node Group)
  - startTime: 2300
    title: Finding Providers & Upbound Cloud
  - startTime: 2840
    title: 'Q&A: Credentials & Access Control'
  - startTime: 3150
    title: Crossplane Future Plans
  - startTime: 3238
    title: Conclusion and Final Thoughts
duration: 3334
guests:
  - vfarcic
resources:
  - title: Crossplane documentation
    type: url
    url: 'https://docs.crossplane.io/'
    category: documentation
  - title: Crossplane contrib providers
    type: url
    url: 'https://github.com/crossplane-contrib'
    category: code
  - title: Equinix Metal provider for Crossplane
    type: url
    url: 'https://github.com/crossplane-contrib/provider-equinix-metal'
    category: code
  - title: Civo provider for Crossplane
    type: url
    url: 'https://github.com/crossplane-contrib/provider-civo'
    category: code
  - title: SQL provider for Crossplane
    type: url
    url: 'https://github.com/crossplane-contrib/provider-sql'
    category: code
---
