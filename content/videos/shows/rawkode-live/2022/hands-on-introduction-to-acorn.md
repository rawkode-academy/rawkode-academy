---
id: hands-on-introduction-to-acorn
slug: hands-on-introduction-to-acorn
title: Hands-on Introduction to Acorn
description: >-
  Acorn is an application packaging and deployment framework that simplifies
  running apps on Kubernetes. Acorn is able to package up all of an applications
  Docker images, configuration, and deployment specifications into a single
  Acorn image artifact. This artifact is publishable to any OCI container
  registry allowing it to be deployed on any dev, test, or production
  Kubernetes. The portability of Acorn images enables developers to develop
  applications locally and move to production without having to switch tools or
  technology stacks.


  Developers create Acorn images by describing the application configuration in
  an Acornfile. The Acornfile describes the whole application without all of the
  boilerplate of Kubernetes YAML files. The Acorn CLI is used to build, deploy,
  and operate Acorn images on any Kubernetes cluster.


  ---


  Introducing Acorn, a simple application deployment framework for Kubernetes
  developed by the team at Acorn Labs in this episode!


  Darren Shepherd, the Chief Architect at Acorn labs, is joining me live today.
  Derek's been in the Kubernetes space for a while and works on K3s. His focus
  has been on helping people deploy clusters, which was the main thing he did in
  the last 5-6 years at Rancher. Sit back and listen to this conversation for a
  live walkthrough of Acorn, its features, benefits, potential, and scope for
  improvement.


  To start with, however, Acorn is an application packaging and deployment
  framework that simplifies running apps on Kubernetes. It can package all of an
  application's Docker images, configuration, and deployment specifications into
  a single Acorn image artefact, which is publishable to any OCI container
  registry allowing it to be deployed on any dev, test, or production
  Kubernetes. This portability of Acorn images enables developers to develop
  applications locally and move to production without having to switch tools or
  technology stacks.


  Points to note:

  ● Acorn took tons of inspiration from Docker, and Docker compose its user
  experience. It would help people pick up and learn Docker quickly.

  ● How K3s came from Rio: This was owing to the user's demand for raw access to
  Kubernetes.

  ● How do developers create Acorn images? By describing the application
  configuration in an Acorn File. The Acorn File describes the whole application
  without all of the boilerplate of Kubernetes YAML files. The Acorn CLI is used
  to build, deploy, and operate Acorn images on any Kubernetes cluster.

  ● Kubernetes improvement: There's a lot of power and flexibility in
  Kubernetes. That leads to a lot of operational complexities. Creating a
  fundamentally abstracted from Kubernetes, then we can drastically reduce the
  operational side.
publishedAt: 2022-08-25T17:00:00.000Z
technologies:
  - acorn
show: rawkode-live
videoId: c3p1ypeqfmorfwwy2ypcrigm
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 179
    title: Introduction to Acorn
  - startTime: 236
    title: Guest Introduction and Motivation for Acorn
  - startTime: 239
    title: Introduction
  - startTime: 346
    title: 'Acorn''s Focus: Simplifying Application Deployment'
  - startTime: 966
    title: Comparing Acorn with Other Deployment Tools
  - startTime: 1154
    title: 'Acorn Architecture: Packaging as OCI Artifacts'
  - startTime: 1307
    title: 'Live Demo: Installing Acorn and Acornfile Basics'
  - startTime: 1645
    title: Syntax
  - startTime: 1731
    title: Environment Variables
  - startTime: 1753
    title: Development Mode
  - startTime: 1779
    title: Building the Application
  - startTime: 1807
    title: 'Live Demo: Running the Application (and Troubleshooting)'
  - startTime: 1814
    title: Run Demo
  - startTime: 2198
    title: Authentication
  - startTime: 2199
    title: 'Acornfile: Secrets and Configuration'
  - startTime: 2269
    title: Bind in Secrets
  - startTime: 2543
    title: Acornfile Language Design Philosophy (Why not Q?)
  - startTime: 2766
    title: 'Security: Secrets, TLS, and Permission Handling'
  - startTime: 2921
    title: Automatic Tls Generation
  - startTime: 2993
    title: 'Acornfile: Args vs. Local Data'
  - startTime: 2996
    title: What's the Difference between Local Data and Arts
  - startTime: 3044
    title: Local Data
  - startTime: 3097
    title: Mapping Acorn Concepts to Kubernetes Resources
  - startTime: 3125
    title: Namespaces
  - startTime: 3311
    title: Security Features and Philosophy Deep Dive
  - startTime: 3416
    title: Handling Advanced Use Cases and Breaking Abstraction
  - startTime: 3683
    title: 'Future: Extension Points and Integrations'
  - startTime: 3784
    title: Scaling and Deployment Strategies
  - startTime: 3786
    title: How Do I Handle Scale
  - startTime: 3863
    title: Installation Permissions and vCluster Workaround
  - startTime: 3971
    title: Stateful Applications and Manual StatefulSets
  - startTime: 4013
    title: Stateful Applications
  - startTime: 4465
    title: Request Permissions
  - startTime: 4590
    title: 'Vision: An Ecosystem of Shareable Acorn Apps'
  - startTime: 4716
    title: Roadmap and Upcoming Features
  - startTime: 4888
    title: Acorn Image Structure (OCI Artifact Details)
  - startTime: 5036
    title: Handling Images from Multiple Registries
  - startTime: 5124
    title: Conclusion and Farewell
duration: 5208
---

