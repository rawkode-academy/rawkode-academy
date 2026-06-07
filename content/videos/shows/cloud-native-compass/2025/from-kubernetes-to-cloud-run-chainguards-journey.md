---
id: hbkqmiw7xfe2dxrarck938yl
slug: from-kubernetes-to-cloud-run-chainguards-journey
title: 'From Kubernetes to Cloud Run: Chainguard''s Journey'
description: >-
  Jason Hall walks through Chainguard's migration of its image-serving
  infrastructure from Kubernetes and Knative to Google Cloud Run, covering
  multi-region Terraform modules, least-privilege IAM, R2 for blob storage, and
  BigQuery-backed event logging.
whatYouWillLearn:
  - "Identify when mostly stateless, spiky-traffic workloads are better moved from Kubernetes or Knative to Cloud Run."
  - "Use Knative-compatible container patterns to move services while removing node and cluster management."
  - "Implement least-privilege IAM, R2 blob storage, and BigQuery event logging for secure image-serving operations."
publishedAt: 2025-01-16T17:00:00.000Z
type: recorded
category: interview
technologies:
  - kubernetes
  - knative
  - terraform
  - opentofu
show: cloud-native-compass
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 51
    title: Guest Introduction & Container Background
  - startTime: 183
    title: Why Migrate from Kubernetes?
  - startTime: 272
    title: Knative and Handling Spiky Traffic
  - startTime: 311
    title: Cloud Run for Stateless Services
  - startTime: 582
    title: Infrastructure Pillars & Migration Scope
  - startTime: 735
    title: Multi-Region Architecture on Cloud Run
  - startTime: 1168
    title: 'Security: Least Privilege and IAM'
  - startTime: 1596
    title: Using Managed Cloud Services
  - startTime: 2376
    title: Developer Experience
  - startTime: 2762
    title: BigQuery for Event Logging
  - startTime: 2999
    title: 'Infrastructure as Code: Terraform & OpenTofu'
  - startTime: 3145
    title: Future Roadmap & The Value of Focus
  - startTime: 3312
    title: Conclusion
duration: 3371
audioFileSize: 80894581
guests:
  - imjasonh
resources:
  - title: >-
      Chainguard blog article about migrating from Kubernetes and Knative to
      Cloud Run
    type: url
    category: other
  - title: chainguard-dev/terraform-infra-common
    url: 'https://github.com/chainguard-dev/terraform-infra-common'
    type: url
    category: code
---
