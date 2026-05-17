---
id: vt7ini6wdrms1hbc8z9rk44u
slug: klustered-teams-ambassador-labs-and-fairwinds
title: Klustered Teams - Ambassador Labs & Fairwinds
description: >-
  Ambassador Labs and Fairwinds break each other's Kubernetes clusters. Fixes
  include OOM memory limits, a CoreDNS rewrite hijack pointing to a rogue
  Postgres in kube-public, a hijacked kubectl shell function, node taints, and
  a self-recreating NetworkPolicy.
publishedAt: 2022-03-04T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - coredns
  - postgresql
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 104
    title: Introduction & Sponsors
  - startTime: 166
    title: Introducing Team Ambassador Labs
  - startTime: 174
    title: Team Ambassador Labs Introductions
  - startTime: 250
    title: Start of Team 1 Challenge (Ambassador Labs vs Fairwinds' Break)
  - startTime: 293
    title: 'Initial Cluster Diagnosis (`get nodes`, `get pods`)'
  - startTime: 374
    title: Identifying OOM Killed and Memory Limits
  - startTime: 421
    title: Fixing Memory Limits
  - startTime: 503
    title: Testing Application Connectivity (Initial Failure)
  - startTime: 570
    title: Discovering the "Gotcha" Message & First Hint
  - startTime: 611
    title: 'Investigating Networking (Ingress, Network Policies)'
  - startTime: 698
    title: Checking Application Image
  - startTime: 756
    title: Attempting to Deploy V2
  - startTime: 796
    title: V2 Still Shows "Gotcha"
  - startTime: 966
    title: Checking Service Endpoints (Matches Pod IP)
  - startTime: 1111
    title: Discussion on Image Source & Lower Level Issues
  - startTime: 1188
    title: ASCII Art Message Found
  - startTime: 1217
    title: 'Hint 1: System Namespaces'
  - startTime: 1272
    title: 'Exploring System Namespaces (`kube-system`, `kube-public`)'
  - startTime: 1686
    title: Rogue Postgres Discovered in `kube-public`
  - startTime: 1843
    title: Understanding the Postgres Setup & Data Injection Idea
  - startTime: 2010
    title: Investigating CoreDNS Configuration
  - startTime: 2105
    title: CoreDNS Rewrite Rule Found (DNS Hijack)
  - startTime: 2117
    title: Fixing CoreDNS Configuration
  - startTime: 2255
    title: 'Restarting Application Pod & Testing (New Error: DB Connection)'
  - startTime: 2322
    title: 'Hint from Chat: Default Postgres Service has No Endpoints'
  - startTime: 2353
    title: Identifying Missing Labels on Default Postgres Pod
  - startTime: 2435
    title: Investigating Default Postgres StatefulSet
  - startTime: 2734
    title: Finding Replicas Set to Zero
  - startTime: 2797
    title: Confirming Team 1 Success (V2 Running)
  - startTime: 2807
    title: Team Ambassador Labs Debrief
  - startTime: 2830
    title: Transition to Team Fairwinds
  - startTime: 2910
    title: Team Fairwinds Introductions
  - startTime: 3018
    title: Start of Team 2 Challenge (Fairwinds vs Ambassador Labs' Break)
  - startTime: 3073
    title: Initial KubeConfig Issues (Typo in "keys")
  - startTime: 3203
    title: KubeConfig Error Persists
  - startTime: 3531
    title: Suspecting the Kubectl Binary/Command
  - startTime: 3695
    title: 'Hint File Review ("Carta", "Tainted Love")'
  - startTime: 3730
    title: Investigating KubeConfig Keys & Typos Again
  - startTime: 4108
    title: Bypassing the Hijacked Kubectl (`/usr/bin/kubectl`)
  - startTime: 4191
    title: Finding the Kubectl Function in `.bashrc`
  - startTime: 4221
    title: Unsetting the Kubectl Function
  - startTime: 4230
    title: Fixing KubeConfig Key Swap & Testing Kubectl
  - startTime: 4250
    title: 'Diagnosis: Pending Pod and Node Taints'
  - startTime: 4333
    title: Fixing Node Taints
  - startTime: 4384
    title: Testing V1 Application (Still Not Working)
  - startTime: 4470
    title: 'Hint 3: Policy Agent'
  - startTime: 4487
    title: Discovering the Network Policy
  - startTime: 4527
    title: Deleting the Network Policy
  - startTime: 4542
    title: Testing V1 Application (Working)
  - startTime: 4549
    title: Attempting to Deploy V2 Again
  - startTime: 4597
    title: Network Policy Reappears - Investigating Recreators
  - startTime: 4694
    title: Checking System Cron Job
  - startTime: 4720
    title: Finding and Removing the Cron Job Entries
  - startTime: 4743
    title: Editing Deployment to V2 Again
  - startTime: 4781
    title: Confirming Team 2 Success (V2 Running)
  - startTime: 4838
    title: Team Fairwinds Debrief
  - startTime: 4879
    title: Conclusion & Thanks
duration: 4990
guests:
  - daniel-bryant
  - edidiong-asikpo
  - alexandre-gervais
  - andy-suderman
resources:
  - type: url
    title: Teleport
    url: 'https://goteleport.com/'
    category: other
  - type: url
    title: Emissary-Ingress
    url: 'https://emissary-ingress.dev/'
    category: other
---

