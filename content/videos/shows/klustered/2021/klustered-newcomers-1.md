---
id: phimrqhbsfj1y0gl2as0s3ce
slug: klustered-newcomers-1
title: 'Klustered: Newcomers #1'
description: >-
  Newcomers edition of Klustered. Jeremy, Jason, and Tom from Equinix Metal
  debug a broken Kubernetes cluster with kubectl, fixing a port mismatch, a 1Mi
  memory limit, a scheduler startup delay, a scaled-down Postgres StatefulSet,
  and a service selector typo.
publishedAt: 2021-05-27T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - containerd
  - teleport
  - postgresql
  - rust
show: klustered
chapters:
  - startTime: 0
    title: Viewer Comments
  - startTime: 50
    title: Introductions
  - startTime: 61
    title: Introduction and Show Premise
  - startTime: 112
    title: Guest Introductions
  - startTime: 244
    title: Connecting to the Cluster
  - startTime: 300
    title: kubeadm KUBECONFIG
  - startTime: 304
    title: Initial Troubleshooting Strategy
  - startTime: 379
    title: Checking Kubernetes API Server Connection
  - startTime: 480
    title: kubectl get pods
  - startTime: 492
    title: Listing Pods in All Namespaces
  - startTime: 510
    title: kubectl describe pods
  - startTime: 518
    title: Investigating the Failing Application Pod
  - startTime: 628
    title: 'Analyzing Pod Description: Sandbox Error & Port Mismatch'
  - startTime: 666
    title: Troubleshooting Sandbox Creation Issues
  - startTime: 811
    title: Finding Pod Node Assignment
  - startTime: 889
    title: Connecting to the Problematic Node
  - startTime: 1010
    title: Containerd logs
  - startTime: 1100
    title: Kubelet logs
  - startTime: 1180
    title: Describing the Application Deployment
  - startTime: 1185
    title: kubectl describe deployment
  - startTime: 1336
    title: Confirming Correct Application Port
  - startTime: 1400
    title: kubectl edit deployment
  - startTime: 1401
    title: 'Editing Deployment: Fixing Port Mismatch (8081 to 8080)'
  - startTime: 1516
    title: Checking Pod Status After Port Fix
  - startTime: 1578
    title: 'Analyzing New Pod Describe: Resource Limits Issue (1Mi memory)'
  - startTime: 1680
    title: Pod Requests & Limits
  - startTime: 1957
    title: 'Editing Deployment: Increasing Memory Limit'
  - startTime: 1985
    title: Application Pod Running/Ready (Problem 1 Solved)
  - startTime: 2026
    title: 'Investigating Kube-System Pods: Scheduler Issue'
  - startTime: 2100
    title: Liveness & Readiness Probes
  - startTime: 2133
    title: 'Describing the Scheduler Pod: Identifying Startup Delay'
  - startTime: 2281
    title: Fixing Static Pod Manifests (Scheduler Delay)
  - startTime: 2340
    title: Static Pod Manifests
  - startTime: 2490
    title: Checking Scheduler Status After Fix
  - startTime: 2580
    title: Debugging Kubernetes Services
  - startTime: 2586
    title: 'All Pods Running, Application Still Unreachable'
  - startTime: 2711
    title: 'Troubleshooting Application: Database Connection'
  - startTime: 2751
    title: Checking for Database (StatefulSet)
  - startTime: 2817
    title: Identifying StatefulSet Replicas = 0
  - startTime: 2820
    title: kubectl scale
  - startTime: 2871
    title: Scaling the Database StatefulSet
  - startTime: 2984
    title: 'Database Pod Running, Application Still Failing'
  - startTime: 3077
    title: Troubleshooting Application Pod Again (Checking YAML)
  - startTime: 3121
    title: 'Analyzing Application Pod YAML: CPU Limit Issue ("1")'
  - startTime: 3186
    title: 'Editing Deployment: Fixing CPU Limit and Image Pull Policy'
  - startTime: 3270
    title: ImagePullPolicies
  - startTime: 3332
    title: 'Checking Pod Status: CPU Limit Resolved (Pod Pending)'
  - startTime: 3437
    title: 'Editing Deployment: Fixing Image Pull Policy ("Never" to "Always")'
  - startTime: 3493
    title: 'Editing Deployment: Fixing CPU Limit Again ("1" to "1000m")'
  - startTime: 3557
    title: 'Pod Running/Ready, Application Still Timing Out: Checking Services'
  - startTime: 3600
    title: Service Endpoints
  - startTime: 3677
    title: Describing the Postgres Service
  - startTime: 3752
    title: 'Analyzing Service: No Endpoints'
  - startTime: 3925
    title: 'Identifying Label Mismatch: Service Selector vs. Pod Label'
  - startTime: 4037
    title: Editing Service Selector to Match Pod Labels
  - startTime: 4189
    title: Application Access Confirmed!
  - startTime: 4210
    title: Conclusion and Lessons Learned
  - startTime: 4522
    title: Checking Containerd and Kubelet Status/Logs
duration: 4350
guests:
  - thomcrowe
  - jeremytanner
resources: []
---

