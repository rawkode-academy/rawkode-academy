---
id: jder260f0z8zix9nh7u198mx
slug: klustered-part-iii
title: Klustered (Part III)
description: >-
  Michael Hausenblas joins to debug two broken Kubernetes clusters: Justin
  Garrison's cluster with expired control-plane certificates and MetalLB
  trouble, and SIG Honk's cluster with a malicious sshd, a swapped API server
  image, and disabled controller-manager flags.
publishedAt: 2021-03-04T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - metallb
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 56
    title: Introduction and Show Premise
  - startTime: 220
    title: Kluster 003 by Justin Garrison
  - startTime: 223
    title: Introducing Cluster 1 (Cluster Three by Justin Garrison)
  - startTime: 260
    title: 'Initial Diagnosis: kubectl Fails (Certificate Error)'
  - startTime: 334
    title: SSH Access via Teleport & Finding the MOTD Hint
  - startTime: 703
    title: Fixing Cluster 1 Expired Certificates
  - startTime: 935
    title: Troubleshooting API Server Restart (Static Pod Issue)
  - startTime: 1287
    title: Applying Certificate Fixes to All Control Planes
  - startTime: 1444
    title: Cluster 1 API Server Access Restored
  - startTime: 1507
    title: Troubleshooting Cluster 1 Load Balancer (MetalLB/CCM)
  - startTime: 1864
    title: Identifying and Attempting to Fix CCM Authentication Secret
  - startTime: 2481
    title: Troubleshooting Cluster 1 DNS (dig & resolv.conf)
  - startTime: 2848
    title: Concluding Cluster 1 (Partially Unsolved)
  - startTime: 2880
    title: >-
      Kluster 006 by SIG Honk (Ian Coldwater, Duffie Cooley, Rory McCune, Brad
      Geesaman)
  - startTime: 2914
    title: Introducing Cluster 2 (Cluster Two by Team SIGHONK)
  - startTime: 2932
    title: 'Initial Diagnosis: kubectl Works, SSH Behaves Strangely'
  - startTime: 3053
    title: Investigating Containerized SSH Session
  - startTime: 3273
    title: Accessing Host Filesystem via SSH Forwarding
  - startTime: 3449
    title: Fixing Malicious SSHD Binary on Host
  - startTime: 3557
    title: Troubleshooting WordPress Deployment (No Pods Created)
  - startTime: 3609
    title: Identifying Permissions Issue (Cannot Delete ReplicaSet)
  - startTime: 3784
    title: Identifying Malicious API Server Image & Admission Plugins
  - startTime: 3956
    title: Fixing API Server Image on Control Planes
  - startTime: 4983
    title: Troubleshooting Controller Manager (No Pods Created)
  - startTime: 5298
    title: Fixing Controller Manager Flags (Enabling ReplicaSet Controller)
  - startTime: 5542
    title: Verifying WordPress Deployment (Pods Running)
  - startTime: 5571
    title: WordPress Service Accessible
  - startTime: 5639
    title: Final Wrap-up
duration: 5765
guests:
  - michael-hausenblas
resources:
  - title: Klustered GitLab repository
    type: url
    url: https://gitlab.com/rawkode/klustered
    category: code
  - title: Justin Garrison's Ansible playbook repository for breaking the cluster
    type: url
    category: code
---

