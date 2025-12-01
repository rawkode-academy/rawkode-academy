---
id: crossplane-in-action
slug: crossplane-in-action
title: Crossplane in Action
description: "In this episode, Viktor guides us through a complete demo of Crossplane in action.\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F465 About the Guests\n\nViktor Farcic\n\n  Developer Advocate at @upbound_io\n\n\n\U0001F426 https://twitter.com/vfarcic\n\U0001F9E9 https://github.com/vfarcic\n\n\n\n\U0001F528 About the Technologies\n\nCrossplane\n\nCrossplane is an open source Kubernetes add-on that enables platform teams to assemble infrastructure from multiple vendors, and expose higher level self-service APIs for application teams to consume. Crossplane effectively enables platform teams to quickly put together their own opinionated platform declaratively without having to write any code, and offer it to their application teams as a self-service Kubernetes-style declarative API.\nBoth the higher level abstractions as well as the granular resources they are composed of are represented simply as objects in the Kubernetes API, meaning they can all be provisioned and managed by kubectl, GitOps, or any tools that can talk with the Kubernetes API. To facilitate reuse and sharing of these APIs, Crossplane supports packaging them in a standard OCI image and distributing via any compliant registry.\nPlatform engineers are able to define organizational policies and guardrails behind these self-service API abstractions. The developer is presented with the limited set of configuration that they need to tune for their use-case and is not exposed to any of the complexities of the low-level infrastructure below the API. Access to these APIs is managed with Kubernetes-native RBAC, thus enabling the level of permissioning to be at the level of abstraction.\nWhile extending the Kubernetes control plane with a diverse set of vendors, resources, and abstractions, Crossplane recognized the need for a single consistent API across all of them. To this end, we have created the Crossplane Resource Model (XRM). XRM extends the Kubernetes Resource Model (KRM) in an opinionated way, resulting in a universal experience for managing resources, regardless of where they reside. When interacting with the XRM, things like credentials, workload identity, connection secrets, status conditions, deletion policies, and references to other resources work the same no matter what provider or level of abstraction they are a part of.\n\n\U0001F30F https://crossplane.io/\n\U0001F426 https://twitter.com/crossplane_io\n\U0001F9E9 https://github.com/crossplane/crossplane\n\n#IaaC"
publishedAt: 2021-09-09T17:00:00.000Z
technologies:
  - crossplane
show: rawkode-live
videoId: i3y48lfgt09qvoupcis4dkov
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
---

