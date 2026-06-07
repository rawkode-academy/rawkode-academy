---
id: gz1nbyatbi6h3q1usddwkdqh
slug: github-authentication
title: GitHub Authentication
description: >-
  Live walkthrough of configuring single sign on against GitHub teams and
  organizations for an existing Teleport cluster: creating the OAuth app,
  writing the GitHub connector YAML, fixing the team requirement, then granting
  SSH access by editing a Teleport role.
whatYouWillLearn:
  - "Create a GitHub OAuth app with the Teleport callback URL."
  - "Configure Teleport's GitHub connector with organization and team restrictions in YAML."
  - "Grant SSH access by mapping the GitHub team to a Teleport role."
publishedAt: 2022-05-04T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - teleport
chapters:
  - startTime: 26
    title: Introduction to GitHub Authentication with Teleport SSO
  - startTime: 103
    title: Prerequisites & Existing Teleport Setup
  - startTime: 241
    title: Creating the GitHub OAuth Application
  - startTime: 318
    title: Configuring the Teleport GitHub Connector (YAML)
  - startTime: 488
    title: Applying Configuration & Initial Login Attempt
  - startTime: 534
    title: Troubleshooting & Fixing the GitHub Team Requirement
  - startTime: 615
    title: Successful Web UI Login via GitHub
  - startTime: 644
    title: 'Q&A: Vault vs. Teleport Comparison'
  - startTime: 745
    title: Granting SSH User Access by Modifying Teleport Role
  - startTime: 1114
    title: 'Q&A: Auto-scaling, Machine ID & Other Features'
  - startTime: 1241
    title: Conclusion & Wrap-up
duration: 1289
guests: []
resources:
  - title: Teleport GitHub SSO Documentation
    type: url
    url: 'https://goteleport.com/docs/admin-guides/access-controls/sso/github-sso/'
    category: documentation
  - title: Teleport RBAC Deep Dive
    type: url
    category: other
  - title: Teleport Machine ID Q&A with Ben Adams
    type: url
    category: other
  - title: Teleport Windows Desktop Access Video
    type: url
    category: other
---
