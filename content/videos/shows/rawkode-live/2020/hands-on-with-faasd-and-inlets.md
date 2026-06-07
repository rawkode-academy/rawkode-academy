---
id: mdv5rucpczre2hmjslcad38r
slug: hands-on-with-faasd-and-inlets
title: Hands-on with faasd & Inlets
description: >-
  Alex Ellis joins David to install faasd on Equinix Metal via cloud-init,
  deploy a Go function, demo containerd pause for fast cold starts and async
  callbacks, then expose a cluster service publicly using inlets-operator and
  arkade.
whatYouWillLearn:
  - "Install faasd on Equinix Metal with cloud-init, then deploy and validate core components via faas-cli."
  - "Create a Go-based function from templates, build it, redeploy after code changes, and test sync and async calls."
  - "Expose your faasd function through inlets-operator using arkade by installing ingress, cert manager, and TLS-enabled public access."
publishedAt: 2020-11-20T17:00:00.000Z
type: live
category: tutorial
technologies:
  - inlets
  - openfaas
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 80
    title: Introductions
  - startTime: 110
    title: Introduction and Welcome
  - startTime: 164
    title: 'Introducing faasd, Inlets, and Guest Alex Ellis'
  - startTime: 262
    title: 'Guest Introduction: Alex Ellis & Open Source Journey'
  - startTime: 294
    title: 'Introducing faasd: A Lightweight Serverless Platform'
  - startTime: 363
    title: Community Engagement and Contributions
  - startTime: 507
    title: OpenFaaS Community Growth
  - startTime: 612
    title: Addressing Viewer Comments & Plan Overview
  - startTime: 615
    title: Installing faasd with cloud-init on Equinix Metal
  - startTime: 650
    title: 'Hands-on Setup: Provisioning a Bare Metal Server'
  - startTime: 670
    title: Setting up faasd via Cloud-Init
  - startTime: 783
    title: Examining the faasd Cloud-Init Script
  - startTime: 900
    title: Installing faasd manually
  - startTime: 905
    title: Setting up faasd with the Install Script
  - startTime: 1020
    title: What is faasd?
  - startTime: 1023
    title: 'Deep Dive: Understanding faasd''s Lightweight Architecture'
  - startTime: 1098
    title: Comparing faasd to Complex Kubernetes Deployments
  - startTime: 1148
    title: faasd Use Cases and Benefits of Simplicity
  - startTime: 1298
    title: faasd on Raspberry Pi & Personal Use Cases
  - startTime: 1381
    title: Verifying faasd Installation with faas-cli
  - startTime: 1433
    title: 'Core faasd Components (Gateway, Prometheus, NATS)'
  - startTime: 1525
    title: Adding containers to faasd
  - startTime: 1611
    title: Adding a Custom Service (InfluxDB) to faasd
  - startTime: 1662
    title: Restarting and Debugging the faasd Service
  - startTime: 1897
    title: 'Verifying Added Services (InfluxDB, Prometheus)'
  - startTime: 2040
    title: Building our first FaaS function
  - startTime: 2056
    title: Building & Deploying Functions Locally to faasd
  - startTime: 2120
    title: Setting up faas-cli on Client Machine
  - startTime: 2305
    title: Using Function Templates (faas-cli template store)
  - startTime: 2347
    title: Creating a New Function (Golang Middleware)
  - startTime: 2397
    title: Examining the Function Stack.yml and Code
  - startTime: 2492
    title: Logging into the Remote faasd Gateway (faas-cli login)
  - startTime: 2647
    title: 'Security Considerations: Gateway TLS'
  - startTime: 2700
    title: Setting FaaS Gateway URL Environment Variable
  - startTime: 2731
    title: Deploying the Function to faasd
  - startTime: 2815
    title: 'Deployment Process (Build, Push, Deploy) Explained'
  - startTime: 2841
    title: Synchronous Function Invocation (Browser Test)
  - startTime: 2858
    title: Modifying Function Code and Redeploying
  - startTime: 2940
    title: Super fast cold starts with faasd
  - startTime: 2961
    title: Containerd Pause Feature for Fast Cold Starts
  - startTime: 2985
    title: Manually Pausing a Function Container (ctr)
  - startTime: 3057
    title: Cold Start Demonstration via Browser Invocation
  - startTime: 3110
    title: Asynchronous Function Invocation
  - startTime: 3158
    title: Checking Queue Worker Logs for Async Events
  - startTime: 3211
    title: Configuring Callback URL for Asynchronous Results
  - startTime: 3247
    title: Using a Request Bin to Receive Callbacks
  - startTime: 3300
    title: Invoking Function with X-Callback-Url Header
  - startTime: 3321
    title: Verifying Asynchronous Callback Result
  - startTime: 3366
    title: Scaling Down and Pausing Functions for Efficiency
  - startTime: 3424
    title: 'Q&A: Pausing Mechanism'
  - startTime: 3463
    title: 'Introducing Inlets: Secure Tunnels'
  - startTime: 3470
    title: Introduction to inlets
  - startTime: 3472
    title: 'Inlets Use Cases (Developer, Hybrid Cloud, Secure Access)'
  - startTime: 3600
    title: Exposing a service with inlets and the inlets operator with arkade
  - startTime: 3640
    title: 'Introducing Arcade: A Marketplace for Kubernetes'
  - startTime: 3665
    title: Exploring get-arcade.dev
  - startTime: 3681
    title: Installing Arcade CLI
  - startTime: 3738
    title: Installing Inlets Operator with Arcade
  - startTime: 3760
    title: How the Inlets Operator Works
  - startTime: 3840
    title: Following Inlets Pro Tutorial with Equinix Metal
  - startTime: 3880
    title: Setting up Equinix Metal Credentials
  - startTime: 3969
    title: Running Inlets Operator Install Command (Provider Config)
  - startTime: 4099
    title: Installing Ingress NGINX with Arcade
  - startTime: 4157
    title: Installing Cert Manager with Arcade
  - startTime: 4186
    title: Checking for Server Provisioning (Debugging Region Issue)
  - startTime: 4245
    title: Correcting Install Command with Proper Region
  - startTime: 4267
    title: Server Provisioning Starts (Correct Region)
  - startTime: 4387
    title: Server Provisioned and Inlets Client Connecting
  - startTime: 4495
    title: Testing Exposed Service via Public IP
  - startTime: 4530
    title: Exposing Applications & TLS with Inlets Operator (Tutorial Walkthrough)
  - startTime: 4636
    title: Using Arcade to Install OpenFaaS & Other Tools (Example)
  - startTime: 4700
    title: The Philosophy Behind Project Creation ("Start With Why")
  - startTime: 4769
    title: Arcade Simplifies Installation of Kubernetes Ecosystem Tools
  - startTime: 4952
    title: Contributing Packages to Arcade
  - startTime: 5080
    title: Listing Available Arcade Apps and CLIs
  - startTime: 5111
    title: Using Arcade Get for Specific CLI Versions
  - startTime: 5133
    title: Getting Involved & Project Resources
  - startTime: 5198
    title: Wrap-up and Thank You
duration: 5264
guests:
  - alexellis
resources:
  - title: arkade
    type: url
    url: 'https://github.com/alexellis/arkade'
    category: code
  - title: Start With Why
    type: url
    url: 'https://simonsinek.com/books/start-with-why/'
    category: other
---
