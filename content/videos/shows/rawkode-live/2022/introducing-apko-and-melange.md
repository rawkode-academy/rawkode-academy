---
id: f7rvx2rb04zl2vhgoltwedf5
slug: introducing-apko-and-melange
title: Introducing apko & melange
description: >-
  Ariadne Conill, primary author of apko and melange, walks through assembling
  distroless OCI images from APK packages: building an NGINX image with apko,
  packaging GNU hello with melange, signing keys, SBOMs, and GitHub Actions.
whatYouWillLearn:
  - "Assemble distroless OCI images from APK packages with apko."
  - "Turn source code into signed APK packages with melange."
  - "Publish reproducible package repositories and images through GitHub Actions."
publishedAt: 2022-03-17T17:00:00.000Z
type: live
category: tutorial
technologies:
  - apko
  - melange
show: rawkode-live
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 107
    title: Introduction and Guest Introduction
  - startTime: 191
    title: 'What are apko & melange? Overview & Benefits (Scannability, SBOMs, Size)'
  - startTime: 630
    title: Image Size and Removing the Shell
  - startTime: 690
    title: Preparing the Environment (Alpine Setup & Dependencies)
  - startTime: 818
    title: Comparison to Distroless / Bazel
  - startTime: 1284
    title: 'Demonstrating apko: Building an NGINX Image'
  - startTime: 1330
    title: Download the Apko Source Code
  - startTime: 1551
    title: Service Bundle Entry Point Type
  - startTime: 1741
    title: Troubleshooting Docker Load / Kernel Issues
  - startTime: 2327
    title: Recap
  - startTime: 2378
    title: Standard Entry Point
  - startTime: 2425
    title: Introducing Melange and Recipe Structure
  - startTime: 2807
    title: Melange Signing Keys
  - startTime: 2888
    title: Building a Package with Melange
  - startTime: 3074
    title: Using the Custom Package in an apko Image
  - startTime: 3151
    title: Circular Dependency
  - startTime: 3322
    title: Set Up a Repository
  - startTime: 3579
    title: 'Recap: The apko + melange Workflow'
  - startTime: 3600
    title: 'Production Workflow, CICD, and Key Management'
  - startTime: 3660
    title: Github Actions
  - startTime: 3859
    title: Project Status and Future Vision
  - startTime: 4105
    title: Contributing and Community
  - startTime: 4181
    title: Signing Docker Images vs. APKs (Q&A)
  - startTime: 4261
    title: Explaining the Distroless Concept (Q&A)
  - startTime: 4362
    title: Conclusion and Thank You
duration: 4453
guests:
  - ariadne-cg
resources:
  - title: Google's Distroless project
    type: url
    url: 'https://github.com/GoogleContainerTools/distroless'
    category: code
  - title: GNU hello world program
    type: url
    url: 'https://www.gnu.org/software/hello/'
    category: code
  - title: apko examples/nginx.yaml
    type: url
    url: 'https://github.com/chainguard-dev/apko/blob/main/examples/nginx.yaml'
    category: demos
  - title: melange examples/gnu-hello.yaml
    type: url
    url: >-
      https://github.com/chainguard-dev/melange/blob/main/examples/gnu-hello.yaml
    category: demos
---
