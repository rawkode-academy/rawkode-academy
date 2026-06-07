---
id: n7tneoc9na93g1cpnfz7cx6i
slug: part-6-workshop-application-access-with-teleport
title: Part 6. Workshop - Application Access with Teleport
description: >-
  Live workshop covering Teleport application access: configure auth/proxy with
  ACME, join a worker node, then expose NGINX and Grafana as Teleport apps.
  Includes JWT inspection, path-based restrictions, and TSH CLI access.
whatYouWillLearn:
  - "Enable the app service debug mode to inspect Teleport JWT headers and payloads"
  - "Expose NGINX as a Teleport app backed by localhost and wildcard DNS"
  - "Block a private admin page with NGINX, then recover access using app start"
publishedAt: 2021-11-18T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - teleport
  - pulumi
  - docker
  - grafana
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 80
    title: 'Initial Setup (VMs, DNS, Pulumi)'
  - startTime: 207
    title: Install & Configure Teleport Auth/Proxy
  - startTime: 361
    title: Teleport Configure
  - startTime: 450
    title: Add Static Join Tokens
  - startTime: 453
    title: Static Token Authentication
  - startTime: 574
    title: Create Our Admin User
  - startTime: 576
    title: Create Admin User & Web Login
  - startTime: 646
    title: Ssh onto the Worker Node
  - startTime: 735
    title: Debugging Node Join Issue
  - startTime: 973
    title: Explore Teleport Debug App (Dumper)
  - startTime: 983
    title: Debugging Application
  - startTime: 1167
    title: Configure the App Service
  - startTime: 1377
    title: Decoding the JWT
  - startTime: 1530
    title: Add NGINX App via Configuration
  - startTime: 1534
    title: Install Nginx onto Our Teleport Server
  - startTime: 1721
    title: Add Nginx as an Application to the Teleport Cluster
  - startTime: 1947
    title: Restrict Public Access to NGINX
  - startTime: 2026
    title: Exercise Seven
  - startTime: 2028
    title: Add Grafana App via Configuration
  - startTime: 2093
    title: Install Docker
  - startTime: 2317
    title: Customize App DNS Name
  - startTime: 2462
    title: Protect Specific Path with NGINX (on Worker Node)
  - startTime: 2463
    title: Semi-Public Access
  - startTime: 2548
    title: Set Up Our Secret Admin Page
  - startTime: 2867
    title: Expose Worker App via `teleport app start` Command
  - startTime: 2962
    title: The Teleport Start Command
  - startTime: 3135
    title: Debugging App Access after Restriction
  - startTime: 3410
    title: Accessing Apps via TSH CLI
  - startTime: 3843
    title: Client/Server Version Discussion & Conclusion
  - startTime: 3847
    title: A Cli Command To Check the Version of the Client and Server
duration: 3954
guests: []
resources:
  - title: rawcodeacademy/courses GitHub repository
    type: url
    url: 'https://github.com/rawcodeacademy/courses'
    category: code
  - title: Teleport configuration file reference
    type: url
    url: 'https://goteleport.com/docs/reference/config/'
    category: documentation
  - title: jwt.io JWT debugger
    type: url
    url: 'https://jwt.io/'
    category: other
  - title: get.docker.io Docker install script
    type: url
    url: 'https://get.docker.io/'
    category: code
---
