---
id: tpt5t0dgsrai5h4lzutozcvm
slug: klustered-part-vi
title: Klustered (Part VI)
description: >-
  Duffie Cooley joins to debug two broken Kubernetes clusters: an
  ImagePolicyWebhook, Kyverno ClusterPolicy, deny NetworkPolicy and kubelet
  config typo on cluster 11; missing static manifests, immutable etcd DB,
  vm.min_free_kbytes starvation and kubelet memory limits on cluster 13.
whatYouWillLearn:
  - "Diagnose API-server failures from image policy webhook and disablement, then edit manifest settings to allow pod creation again."
  - "Fix node readiness by correcting kubelet config typos and restarting kubelet so scheduling resumes on repaired workers."
  - "Restore cluster 13 by re-adding missing control-plane manifests, removing immutable bits from etcd database files, and resetting vm.min_free_kbytes."
publishedAt: 2021-03-25T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - kyverno
  - coredns
  - etcd
  - containerd
show: klustered
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 140
    title: Introductions
  - startTime: 146
    title: Introduction & Housekeeping
  - startTime: 215
    title: Welcoming Guest Duffy
  - startTime: 290
    title: 'Cluster 011, Broken by @SaiyamPathak'
  - startTime: 296
    title: Starting Cluster 11 Troubleshooting (Siam is the Breaker)
  - startTime: 355
    title: Initial Cluster State Assessment (Nodes & Pods)
  - startTime: 610
    title: Fixing crictl Access
  - startTime: 771
    title: Application Connectivity Test (Port Forward)
  - startTime: 893
    title: Investigating CoreDNS & Controller Manager Pods
  - startTime: 1026
    title: Analyzing CoreDNS Configuration Map
  - startTime: 1252
    title: Checking Database Service Endpoints
  - startTime: 1351
    title: 'Pod Creation Forbidden: Discovering Admission Control'
  - startTime: 1402
    title: Inspecting API Server Admission Control Config
  - startTime: 1481
    title: Removing ImagePolicyWebhook Admission Control Config
  - startTime: 1605
    title: Explaining Node Restriction Admission Controller
  - startTime: 1777
    title: Pod Creation Blocked by Validation Policy
  - startTime: 1840
    title: Identifying Caverno and ClusterPolicy CRDs
  - startTime: 2031
    title: Examining the 'disable-pod' ClusterPolicy
  - startTime: 2169
    title: Deleting the 'disable-pod' Policy
  - startTime: 2245
    title: 'Pods Still Pending: Suspecting Node Readiness/Scheduling'
  - startTime: 2324
    title: Diagnosing Unready Worker Nodes (Kubelet Status)
  - startTime: 2418
    title: Troubleshooting Worker Node 7694F (Kubelet Logs)
  - startTime: 2558
    title: Fixing Kubelet Config File Typo
  - startTime: 2658
    title: Restarting Kubelet on Worker Node
  - startTime: 3008
    title: Node Becomes Ready but Scheduling Disabled (Kubeadm Taint)
  - startTime: 3037
    title: Worker Node Now Ready and Schedulable
  - startTime: 3063
    title: 'Application Still Failing: Re-evaluating Connectivity'
  - startTime: 3785
    title: 'Test Pod Unschedulable: Investigating Scheduler'
  - startTime: 3960
    title: 'Test Pod Running: Database Pod Failing'
  - startTime: 4020
    title: Testing Network Connectivity from Inside a Pod
  - startTime: 4148
    title: Network Works from CoreDNS Pod
  - startTime: 4185
    title: Discovering and Deleting Deny NetworkPolicy
  - startTime: 4215
    title: Application Connectivity Restored
  - startTime: 4233
    title: Upgrading Application to v2
  - startTime: 4295
    title: Cluster 11 Fixed and Application Upgraded
  - startTime: 4320
    title: 'Cluster 013, Broken by @thebsdbox and @dtiber'
  - startTime: 4336
    title: Transition to Cluster 13
  - startTime: 4348
    title: Starting Cluster 13 Troubleshooting (Connection Refused)
  - startTime: 4453
    title: No Kubernetes Components Running (crictl Check)
  - startTime: 4512
    title: Missing Kubernetes Manifests
  - startTime: 4571
    title: Inspecting etcd Directory (Suspicious Files)
  - startTime: 4631
    title: Restoring etcd Manifest
  - startTime: 4710
    title: Restoring API Server Manifest
  - startTime: 4793
    title: 'etcd Failure: Discovering File Permission Issue'
  - startTime: 4913
    title: Identifying Immutable File Attribute on etcd DB
  - startTime: 5049
    title: Explaining Immutable File Attributes (chattr)
  - startTime: 5110
    title: Removing Immutable Attribute from etcd DB
  - startTime: 5218
    title: Restoring etcd Manifest Again (After chattr)
  - startTime: 5278
    title: 'API Server Failure: Out of Memory Error'
  - startTime: 5444
    title: System Memory Restricted
  - startTime: 5510
    title: Identifying Restricted Memory via vm.min_free_kbytes Sysctl
  - startTime: 6142
    title: Comparing Sysctl Value to Healthy Host
  - startTime: 6300
    title: Resetting vm.min_free_kbytes
  - startTime: 6355
    title: API Server Comes Online After Memory Fix
  - startTime: 6386
    title: Restoring Controller Manager and Scheduler Manifests
  - startTime: 6489
    title: 'Control Plane Healthy, Worker Nodes Unready'
  - startTime: 6640
    title: Troubleshooting Worker Node DR44B
  - startTime: 6812
    title: 'DR44B Kubelet Error: Containerd Connection Refused'
  - startTime: 6878
    title: Starting Containerd on DR44B
  - startTime: 6908
    title: DR44B Node Becomes Ready
  - startTime: 7026
    title: Troubleshooting Worker Node QPQH
  - startTime: 7084
    title: 'QPQH Kubelet Status: Killed (SIGKILL)'
  - startTime: 7237
    title: Identifying Kubelet MemoryMax Limit in Systemd Unit
  - startTime: 7268
    title: Removing Kubelet Memory Limit
  - startTime: 7310
    title: QPQH Node Becomes Ready
  - startTime: 7336
    title: 'DR44B Node Issues Return: Too Many Open Files'
  - startTime: 7354
    title: Investigating File Descriptor Limits on DR44B
  - startTime: 7656
    title: DR44B Node Becomes Ready Again (Intermittent?)
  - startTime: 7740
    title: Testing Application on Cluster 13
  - startTime: 7812
    title: Application v2 Deployed and Working
  - startTime: 7840
    title: 'Discussion: Intermittent Issue & Calling it Done'
  - startTime: 7913
    title: Wrap-up and Thanks
duration: 8015
guests:
  - mauilion
resources:
  - title: Equinix Metal
    type: url
    category: other
---
