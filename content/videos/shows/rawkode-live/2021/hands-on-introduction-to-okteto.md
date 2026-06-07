---
id: mbehnf2kqdrdmagxryh6e7tc
slug: hands-on-introduction-to-okteto
title: Hands-on Introduction to Okteto
description: >-
  Ramiro Berrelleza walks through Okteto Cloud and the okteto CLI, deploying the
  Movies sample with Helm and BuildKit, then using okteto up to sync code into a
  live Kubernetes pod. Plus Docker Compose support and preview environments.
whatYouWillLearn:
  - "Deploy a sample app to Okteto Cloud by adding a namespace, credentials, and pipeline in the quick-start flow."
  - "Install and use the Okteto CLI and `okteto up` to sync local code into a running Kubernetes pod."
  - "Run Docker Compose apps and enable preview environments with GitHub Actions from the same Okteto pipeline configuration."
publishedAt: 2021-05-19T17:00:00.000Z
type: live
category: tutorial
technologies:
  - okteto
  - kubernetes
  - helm
  - buildkit
  - docker-compose
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 50
    title: Introductions
  - startTime: 60
    title: Introduction to Okteto
  - startTime: 104
    title: 'Guest Introduction: Ramiro, Founder & CEO'
  - startTime: 303
    title: 'Motivation Behind Okteto: Solving Cloud Native Dev Friction'
  - startTime: 460
    title: Okteto Cloud
  - startTime: 482
    title: 'Hands-on Start: Okteto Cloud Dashboard & Login'
  - startTime: 600
    title: Adding the Movies Repository
  - startTime: 621
    title: Deploying a Sample Application (Movies App)
  - startTime: 696
    title: Okteto Pipeline & Built-in Build Service
  - startTime: 840
    title: 'Exploring the Deployed App & UI Features (Live Logs, Public Endpoint)'
  - startTime: 992
    title: Installing & Using the Okteto CLI
  - startTime: 1080
    title: Working on a Service Locally
  - startTime: 1096
    title: Starting a Dev Environment with `okteto up`
  - startTime: 1182
    title: 'Live Development: File Synchronization & Hot Reloading (Fixing a Bug)'
  - startTime: 1477
    title: 'How `okteto up` Works (Okteto YAML, SyncThing, Port Forwarding)'
  - startTime: 1872
    title: Okteto Cloud Pricing (Free Tier) & Deployment Options (Any Cluster)
  - startTime: 2064
    title: Integrating with Other Kubernetes Tools
  - startTime: 2280
    title: Deploying with Docker Compose (Voting App Demo)
  - startTime: 2400
    title: Deploying with docker-compose.yml
  - startTime: 2671
    title: Remote Builds with BuildKit (Not Needing Docker Locally)
  - startTime: 3060
    title: Preview Environments & GitHub Actions
  - startTime: 3071
    title: Preview Environments (CI/CD Integration)
  - startTime: 3280
    title: One-Click Deploy (Develop on Okteto Button)
  - startTime: 3371
    title: 'Q&A: Team Development & Upcoming Divert Feature'
  - startTime: 3496
    title: Conclusion & Community Call to Action
duration: 3565
guests:
  - rberrelleza
resources:
  - title: Okteto Quick Start Guide
    type: url
    category: documentation
    url: 'https://www.okteto.com/docs/get-started/dev-quickstart/'
  - title: Okteto Movies sample application
    type: url
    category: demos
    url: 'https://github.com/okteto/movies'
  - title: Okteto Preview Environments documentation
    type: url
    category: documentation
    url: 'https://www.okteto.com/docs/previews/'
  - title: Docker samples voting app
    type: url
    category: demos
    url: 'https://github.com/dockersamples/example-voting-app'
---
