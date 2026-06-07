---
id: ogaami9wop6jhog6miiplwgd
slug: timoni-cue-powered-package-management-for-kubernetes
title: 'Timoni: CUE Powered Package Management for Kubernetes'
description: >-
  Stefan Prodan joins to introduce Timoni, a Kubernetes package manager built on
  CUE and OCI artifacts. Modules and bundles replace Helm charts and YAML
  templating, distributed via container registries with Cosign signing and
  SOPS-encrypted values.
whatYouWillLearn:
  - "Package Kubernetes applications as CUE-based modules stored in OCI registries."
  - "Bundle modules and configuration together, then apply them with Timoni."
  - "Use server side apply so Timoni tracks live state declaratively."
publishedAt: 2023-11-17T17:00:00.000Z
type: live
category: tutorial
technologies:
  - cue
  - timoni
  - kubernetes
  - helm
  - sops
show: rawkode-live
duration: 7580
guests:
  - stefanprodan
resources:
  - title: Timoni comparison with Helm page
    type: url
    url: 'https://timoni.sh/comparison/'
    category: documentation
  - title: Podinfo demo application
    type: url
    url: 'https://github.com/stefanprodan/podinfo'
    category: demos
  - title: Timoni multi-cluster deployments
    type: url
    url: 'https://timoni.sh/bundle-multi-cluster/'
    category: documentation
  - title: SOPS usage documentation for Timoni secrets
    type: url
    url: 'https://timoni.sh/bundle-secrets/'
    category: documentation
---
