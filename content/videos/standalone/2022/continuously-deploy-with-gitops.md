---
id: xi7tekr74r3qfd7pv30lkp0s
slug: continuously-deploy-with-gitops
title: Continuously Deploy with GitOps
description: >-
  Bring GitOps to non-Kubernetes environments using Portainer Stacks backed by a
  Git repository and a docker-compose.yml, with continuous delivery triggered by
  either polling or GitHub webhooks.
whatYouWillLearn:
  - "Use Portainer stacks to deploy Docker Compose files from a Git repository."
  - "Choose polling intervals or GitHub webhooks to trigger automatic redeployments."
  - "Verify updates by watching Portainer add containers after each committed change."
publishedAt: 2022-12-09T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - portainer
  - docker-compose
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 38
    title: What is GitOps and Portainer's Role
  - startTime: 134
    title: Local Development Setup (Docker Compose)
  - startTime: 286
    title: Deploying to Portainer for Production
  - startTime: 357
    title: Configuring the Portainer Stack (Git Source)
  - startTime: 421
    title: Setting up Continuous Deployment (Polling)
  - startTime: 450
    title: Deploying the Stack and Verification
  - startTime: 568
    title: Triggering a Deployment (Polling Demo)
  - startTime: 643
    title: Observing the Automatic Update
  - startTime: 700
    title: 'Alternative Update Method: Webhooks'
  - startTime: 745
    title: Configuring Portainer Webhooks
  - startTime: 805
    title: Triggering a Deployment (Webhook Demo)
  - startTime: 833
    title: Observing the Webhook Update
  - startTime: 842
    title: Conclusion and Summary
duration: 923
guests: []
resources:
  - title: Portainer in Production Course Repository
    type: url
    url: 'https://github.com/rawkode-academy/portainer-in-production'
    category: code
  - title: Portainer Documentation
    type: url
    url: 'https://docs.portainer.io/'
    category: documentation
  - title: Docker Compose Documentation
    type: url
    url: 'https://docs.docker.com/compose/'
    category: documentation
---
