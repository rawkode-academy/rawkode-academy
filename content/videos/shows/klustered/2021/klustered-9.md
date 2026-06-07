---
id: weym8gw0c6g1ol7qjtde1521
slug: klustered-9
title: 'Klustered #9'
description: >-
  Marcos Nils joins to debug two Kubernetes clusters: cluster 17 from Sascha
  Grunert (a rogue node debugger pod and a containerd 'honk' error pointing at
  BPF) and cluster 18 from Billie Cleek (CoreDNS NXDOMAIN rule and a malicious
  mutating webhook).
whatYouWillLearn:
  - "Trace an application update failure in cluster 17 by isolating a container runtime error during pod startup."
  - "Find and stop a suspicious node-level debugger pod while validating other deployment and networking signals."
  - "Resolve cluster 18 by detecting CoreDNS NXDOMAIN behavior and removing a broken mutating webhook."
publishedAt: 2021-04-15T16:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - containerd
  - coredns
  - ebpf
show: klustered
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 83
    title: Introductions
  - startTime: 84
    title: Introduction & Show Overview
  - startTime: 176
    title: Introducing Co-Host Marcos
  - startTime: 227
    title: Starting Cluster 17 Troubleshooting
  - startTime: 230
    title: Kluster 17 - Broken by Sascha Grunert
  - startTime: 283
    title: Initial Cluster 17 Checks
  - startTime: 457
    title: Cluster 17 Application Upgrade Failure (v2)
  - startTime: 513
    title: Debugging OCI Runtime Error ('Honk')
  - startTime: 603
    title: Investigating Cluster 17 Configurations
  - startTime: 1148
    title: Investigating Node-Specific Issues
  - startTime: 1318
    title: Discovering Rogue 'Node Debugger' Pod
  - startTime: 1444
    title: Examining Rogue Pod Manifest
  - startTime: 1533
    title: Debugging Inside Rogue Pod
  - startTime: 1600
    title: Finding Suspicious Host File
  - startTime: 1670
    title: Analyzing Rogue Killing Script
  - startTime: 1709
    title: Stopping Rogue Service & Pods
  - startTime: 1936
    title: Retesting Application Upgrade (Cluster 17)
  - startTime: 1995
    title: 'Cluster 17 App Works, ''Honk'' Remains Mystery'
  - startTime: 2800
    title: Switching to Cluster 18
  - startTime: 2815
    title: Kluster 18 - Broken by Billie Cleek
  - startTime: 2836
    title: Cluster 18 Initial Diagnosis (API Server Down)
  - startTime: 2948
    title: Debugging Control Plane Components (Cluster 18)
  - startTime: 3279
    title: Cluster 18 Application Networking Issue
  - startTime: 3348
    title: Debugging Networking from App Pod
  - startTime: 3407
    title: Identifying DNS Issue (Cluster 18)
  - startTime: 3455
    title: Checking CoreDNS Configuration
  - startTime: 3510
    title: 'Found: CoreDNS NXDOMAIN Rule'
  - startTime: 3527
    title: Fixing CoreDNS
  - startTime: 3659
    title: Discovering Mutating Webhook Issue
  - startTime: 3940
    title: Deleting Problematic Mutating Webhook
  - startTime: 3963
    title: Verifying Cluster 18 Control Plane Health
  - startTime: 4097
    title: Cluster 18 App Connectivity & Upgrade Test
  - startTime: 4120
    title: Cluster 18 Resolved
  - startTime: 4200
    title: Kluster 17 Revisited
  - startTime: 4213
    title: Revisiting Cluster 17 ('Honk' Mystery)
  - startTime: 4366
    title: Searching for 'Honk' Binary/Config
  - startTime: 4558
    title: Debugging Containerd on Worker Node
  - startTime: 4905
    title: Inspecting Containerd Configuration
  - startTime: 5062
    title: Cluster 17 Conclusion (BPF Suspected)
  - startTime: 5238
    title: Wrap-up & Thank You
duration: 5373
guests:
  - marcosnils
resources:
  - title: Play with Docker
    type: url
    url: 'https://labs.play-with-docker.com/'
    category: other
  - title: Equinix Metal
    type: url
    url: 'https://deploy.equinix.com/'
    category: other
---
