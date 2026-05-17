---
id: gpflupb79utj4zwvq76deu98
slug: marino-wijay-and-john-anderson
title: Marino Wijay & John Anderson
description: >-
  Marino Wijay and John Anderson fix a sabotaged cluster: Kyverno admission
  webhooks, a Not Ready node with a bad kubelet eviction flag, controller
  manager RBAC, a corrupt API server cert, and Cilium CNI mismatched with
  containerd.
publishedAt: 2022-05-13T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - kyverno
  - cilium
  - cni
  - containerd
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 59
    title: Introduction & Housekeeping
  - startTime: 198
    title: Guest Introductions (Marino Wijay & John Anderson)
  - startTime: 283
    title: Chat about KubeCon
  - startTime: 326
    title: Marino Begins Troubleshooting (Initial Cluster Check)
  - startTime: 372
    title: Export Coop Config
  - startTime: 437
    title: Investigating Pod Status (Container Unknown)
  - startTime: 718
    title: Discovering Kiverno Webhook Error
  - startTime: 780
    title: Debugging Kiverno Installation
  - startTime: 843
    title: Checking Admission Controllers
  - startTime: 972
    title: Deleting Kiverno Resources
  - startTime: 1071
    title: Trying to Redeploy Application Pod
  - startTime: 1139
    title: Realizing Wrong Cluster Context
  - startTime: 1220
    title: Checking Nodes on Correct Cluster (Not Ready)
  - startTime: 1296
    title: Investigating Node Not Ready Status
  - startTime: 1431
    title: Debugging Disk Usage on Worker Node
  - startTime: 1570
    title: Identifying Large Log Files
  - startTime: 1648
    title: Cleaning Up Disk Space
  - startTime: 1699
    title: Checking Node Status After Cleanup
  - startTime: 1858
    title: Debugging Kubelet (Network Issues & Backoff)
  - startTime: 2095
    title: Identifying Kubelet Invalid Allocatable Config
  - startTime: 2156
    title: Checking Kubelet Configuration Files
  - startTime: 2305
    title: Environment File
  - startTime: 2320
    title: Finding Kubelet Eviction Flag
  - startTime: 2348
    title: Restarting Kubelet
  - startTime: 2439
    title: Worker Node Becomes Ready
  - startTime: 2441
    title: Checking Application Deployment
  - startTime: 2464
    title: Attempting Deployment Upgrade (v1 to v2)
  - startTime: 2550
    title: Cube Controller Manager
  - startTime: 2551
    title: 'Hint: Controller Manager Role'
  - startTime: 2583
    title: Checking Controller Manager Static Manifest
  - startTime: 2643
    title: Checking Controller Manager Logs (RBAC Error)
  - startTime: 2731
    title: Understanding Leader Election and Leases
  - startTime: 2799
    title: Identifying Scheduler Config Mistake
  - startTime: 2837
    title: Correcting Controller Manager Config
  - startTime: 2861
    title: Restarting Controller Manager
  - startTime: 2907
    title: Checking for New Replica Set
  - startTime: 3038
    title: Controller Manager Healthy
  - startTime: 3083
    title: New Replica Set Created
  - startTime: 3112
    title: Testing Application Endpoint
  - startTime: 3121
    title: Application Responds (v2)
  - startTime: 3139
    title: 'Marino''s Turn Ends, Discussion of Breaks'
  - startTime: 3171
    title: Swap Hot Seats
  - startTime: 3240
    title: API Server Not Running
  - startTime: 3287
    title: Checking Static Manifests for API Server
  - startTime: 3306
    title: Noticing Certificate File Paths
  - startTime: 3370
    title: Poking API Server Pod (No Logs)
  - startTime: 3415
    title: 'API Server Not Starting, No Logs'
  - startTime: 3479
    title: Checking Kubelet Logs for API Server Info
  - startTime: 3738
    title: 'Kubelet Logs: API Server Backoff'
  - startTime: 4076
    title: Using CRI CTL to Check Containers
  - startTime: 4150
    title: Getting Logs from Failed API Server Container
  - startTime: 4173
    title: Identifying Certificate Trailing Data Error
  - startTime: 4195
    title: Inspecting Certificates
  - startTime: 4252
    title: Identifying Modified Certificate File
  - startTime: 4266
    title: Finding Trailing Data in Certificate File
  - startTime: 4292
    title: Deleting the Broken Certificate
  - startTime: 4318
    title: Attempting to Regenerate Certificate (Wrong Command)
  - startTime: 4378
    title: Regenerating Certificate via Kubeadm
  - startTime: 4436
    title: Verifying Regenerated Certificate
  - startTime: 4486
    title: Restarting Kubelet to Pick Up Certificate
  - startTime: 4492
    title: API Server Running
  - startTime: 4531
    title: CoreDNS and Other Pods Broken
  - startTime: 4579
    title: Attempting Application Deployment Upgrade
  - startTime: 4618
    title: Pods Stuck in Creating State
  - startTime: 4631
    title: 'Pod Logs: Failed to Set Up Network (CNI)'
  - startTime: 4633
    title: Fail To Set Up Network for Sandbox
  - startTime: 4676
    title: Debugging CNI Configuration on Worker Node
  - startTime: 4701
    title: Identifying CNI Version Mismatch Error
  - startTime: 4763
    title: Checking CNI ConfigMap
  - startTime: 4975
    title: Checking CNI Binaries Version
  - startTime: 5114
    title: 'Hint: Dependencies & Release Notes (Containerd)'
  - startTime: 5500
    title: 'Hint: Check kubectl get nodes -o yaml (Different Versions)'
  - startTime: 5522
    title: Identifying Different Containerd Versions on Nodes
  - startTime: 5583
    title: Downgrading Containerd on Worker Node
  - startTime: 5667
    title: Restarting Containerd/Kubelet
  - startTime: 5672
    title: Application Pods Running
  - startTime: 5690
    title: Discussion of Containerd/CNI Bug
  - startTime: 5745
    title: Discussion of Kubernetes Error Messages
  - startTime: 5824
    title: Closing Remarks & Thanks
duration: 5965
guests:
  - marino-wijay
  - john-anderson
resources:
  - title: Rawkode Academy Teleport sponsor link
    type: url
    url: 'https://rawkode.live/teleport'
    category: other
  - title: Rawkode Academy Equinix Metal sponsor link
    type: url
    url: 'https://rawkode.live/metal'
    category: other
  - title: Equinix Metal Console
    type: url
    url: 'https://console.equinix.com'
    category: other
---

