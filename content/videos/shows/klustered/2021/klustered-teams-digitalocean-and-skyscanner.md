---
id: lb152fahj4mgnkhcx1lsnejr
slug: klustered-teams-digitalocean-and-skyscanner
title: 'Klustered Teams: DigitalOcean & Skyscanner'
description: >-
  Skyscanner and DigitalOcean each take on a broken Kubernetes cluster. Fixes
  span expired certs, etcd probes and resource limits, a kube-vip VIP, a rogue
  validating webhook, kube-monkey, and Cilium with kube-proxy replacement.
publishedAt: 2021-07-29T17:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - etcd
  - cilium
  - kube-vip
  - postgresql
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 110
    title: Introductions
  - startTime: 111
    title: Introduction and Sponsor Mention
  - startTime: 175
    title: Introducing Team Skyscanner
  - startTime: 180
    title: Team Skyscanner
  - startTime: 216
    title: Skyscanner Team Introductions
  - startTime: 335
    title: 'Skyscanner''s Challenge Begins: Initial Cluster Access'
  - startTime: 377
    title: Debugging Connection Refused Errors
  - startTime: 483
    title: 'Checking Control Plane Components (Kubelet, Static Pods)'
  - startTime: 552
    title: Investigating API Server Config
  - startTime: 784
    title: Checking API Server Logs (TLS Issue Found)
  - startTime: 862
    title: Renewing Kubernetes Certificates
  - startTime: 910
    title: Restarting API Server and Checking Logs
  - startTime: 997
    title: Forcing Static Pod Restart via Manifest
  - startTime: 1060
    title: Continued API Server Log Analysis
  - startTime: 1121
    title: Investigating Etcd Logs
  - startTime: 1177
    title: API Server is Functional
  - startTime: 1189
    title: Identifying Unready Nodes
  - startTime: 1236
    title: Using k9s for Cluster Overview
  - startTime: 1297
    title: Diagnosing Pod Connectivity to API Server (from k9s errors)
  - startTime: 1334
    title: Considering Application Upgrade Strategy vs. Fixing CNI
  - startTime: 1374
    title: Persistent API Server Connection Issues (from k9s)
  - startTime: 1455
    title: Checking API Server Logs Again (Context Deadline)
  - startTime: 1500
    title: API Server Received Terminate Signal
  - startTime: 1526
    title: Etcd Member Status Check
  - startTime: 1596
    title: Chat Suggests Resource Limits Issue on Etcd
  - startTime: 2010
    title: Kubelet logs show Etcd container failing
  - startTime: 2049
    title: Checking Etcd Logs (Shutdown signal)
  - startTime: 2138
    title: Host Suggests Removing Probes and Limits from Etcd Manifest
  - startTime: 2236
    title: Checking Etcd Logs After Modification (Looks Healthy)
  - startTime: 2278
    title: Checking API Server Status (It works!)
  - startTime: 2362
    title: Attempting Application Update (Deploying v2)
  - startTime: 2402
    title: Application Accessible (Skyscanner Mission Success)
  - startTime: 2426
    title: Skyscanner Team Reflection
  - startTime: 2462
    title: Skyscanner Team Signs Off
  - startTime: 2479
    title: Intermission & Sponsor Thanks
  - startTime: 2519
    title: Introducing Team DigitalOcean
  - startTime: 2520
    title: Team DigitalOcean
  - startTime: 2630
    title: DigitalOcean Team Introductions
  - startTime: 2700
    title: 'DigitalOcean''s Challenge Begins: Cluster Access'
  - startTime: 2801
    title: Initial `kubectl` Fails (Unable to Handle Request)
  - startTime: 2900
    title: Checking Kubelet Logs
  - startTime: 17347
    title: Checking Etcd Status and Logs (Looks Okay)
  - startTime: 17499
    title: API Server Logs (Failing or Missing Response)
  - startTime: 17646
    title: Investigating API Server Manifest and Flags
  - startTime: 17749
    title: Verifying Virtual IP Address
  - startTime: 18068
    title: Cluster Info Command Fails
  - startTime: 18732
    title: Host Hints at API Server Startup Logs
  - startTime: 18966
    title: Looking for Anomaly in API Server Manifest
  - startTime: 19111
    title: Killing and Restarting API Server Process
  - startTime: 19510
    title: API Server Responds After Manual Restart (`kubectl get nodes` works)
  - startTime: 19820
    title: Investigating Webhook Configurations
  - startTime: 19900
    title: Deleting Validating Webhook Configuration
  - startTime: 20070
    title: Attempting Application Update
  - startTime: 20230
    title: Checking Application Access (Internal Server Error)
  - startTime: 20560
    title: Debugging Application Connectivity (Postgres DNS)
  - startTime: 20817
    title: Installing DNS Utils in Pod
  - startTime: 21010
    title: Checking Postgres DNS Resolution (Works)
  - startTime: 21270
    title: Checking Application Logs (No Logs Available)
  - startTime: 21390
    title: Re-examining Application Deployment/Binary
  - startTime: 21630
    title: Checking Services (Clustered and Postgres)
  - startTime: 21668
    title: Discussing Networking Issues (Cilium)
  - startTime: 21690
    title: Checking Network Policies
  - startTime: 21718
    title: Checking Cilium Pods/Daemonset (Recently Restarted)
  - startTime: 21900
    title: Checking Cilium Config Map (kube-proxy replacement disabled)
  - startTime: 22140
    title: Finding and Scaling Down kube-monkey Deployment
  - startTime: 22375
    title: Enabling kube-proxy Replacement in Cilium Config (Probe)
  - startTime: 22560
    title: Forcing Cilium Daemonset Rollout (Add label)
  - startTime: 22965
    title: Checking Application Access Again (Works!)
  - startTime: 23040
    title: DigitalOcean Mission Success & Reflection
  - startTime: 23460
    title: DigitalOcean Team Signs Off
  - startTime: 23508
    title: Outro and Sponsor Thanks
duration: 7050
guests:
  - bhcleek
  - collinshoop
  - morrislaw
  - shahar-levy
  - gjtempleton
  - maruina
  - smirl
resources:
  - title: Teleport sponsor link
    type: url
    url: 'https://rawkode.live/teleport'
    category: other
  - title: Rawkode Discord server
    type: url
    url: 'https://rawkode.chat'
    category: other
---

