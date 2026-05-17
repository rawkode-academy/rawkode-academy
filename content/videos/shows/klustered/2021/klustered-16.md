---
id: xgp6tiusatvjqsse8tour3hl
slug: klustered-16
title: 'Klustered #16'
description: >-
  Klustered is a series of live streams in which myself and a guest join forces
  to fix "broken" #Kubernetes clusters ... on the clock.
publishedAt: 2021-07-23T17:00:00.000Z
type: live
category: tutorial
technologies: []
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 68
    title: Welcome and Housekeeping
  - startTime: 130
    title: 'Guest Introductions: Andy & Rachel'
  - startTime: 240
    title: Rachel's Cluster
  - startTime: 248
    title: Starting with Rachel's Cluster
  - startTime: 287
    title: Initial Cluster Assessment
  - startTime: 334
    title: Identifying Pod Network Issues
  - startTime: 367
    title: Debugging Cilium Logs
  - startTime: 493
    title: Investigating Scheduler and Pods
  - startTime: 584
    title: Node Scheduling Disabled
  - startTime: 603
    title: Pods Creating/Pulling Images
  - startTime: 715
    title: Unexpected Extra Postgres Pods
  - startTime: 790
    title: Checking Application Access via Teleport
  - startTime: 817
    title: Internal Server Error
  - startTime: 870
    title: Identifying Resource Limit Issue
  - startTime: 900
    title: Fixing Resource Limits on Pods
  - startTime: 982
    title: Retesting Application Access
  - startTime: 1131
    title: Debugging Service Definition
  - startTime: 1202
    title: Editing the Service
  - startTime: 1290
    title: Removing Cluster IPs from Service
  - startTime: 1409
    title: Deleting and Recreating Service
  - startTime: 1477
    title: Testing Application After Service Fix
  - startTime: 1575
    title: Application Works (Rachel's Cluster Fixed)
  - startTime: 1604
    title: Discussion on Rachel's Break
  - startTime: 1642
    title: Transition to Andy's Cluster
  - startTime: 1650
    title: Andy's Cluster
  - startTime: 1694
    title: Initial Assessment (Andy's Cluster)
  - startTime: 1731
    title: Discovering Broken Kubectl Binary ("Honk")
  - startTime: 1850
    title: Investigating the Kubectl Binary
  - startTime: 1968
    title: Finding the Real Kubectl Binary
  - startTime: 2080
    title: Restoring Working Kubectl
  - startTime: 2137
    title: Debugging Control Plane Issues
  - startTime: 2167
    title: Checking Static Manifests Directory
  - startTime: 2266
    title: Identifying Modified API Server Image
  - startTime: 2308
    title: Correcting API Server Image in Manifest
  - startTime: 2385
    title: Checking Kubelet Status
  - startTime: 6074
    title: 'Kubelet Running, No API Server Logs'
  - startTime: 6156
    title: Restarting Kubelet
  - startTime: 6206
    title: No API Server Logs After Restart
  - startTime: 6231
    title: Reviewing Admin Config
  - startTime: 6290
    title: Checking Containerd Status
  - startTime: 6322
    title: Containerd Image Pull Errors (TLS)
  - startTime: 6407
    title: Debugging Image Pull Issues
  - startTime: 6461
    title: No Containerd Command/Config Dump
  - startTime: 6518
    title: Pulling Image Locally for Comparison
  - startTime: 6560
    title: TLS Errors Confirmed
  - startTime: 6618
    title: Suspecting Certificate Issues
  - startTime: 6660
    title: Discovering Networking Issues (Ping/IPtables Fail)
  - startTime: 6720
    title: BPF and Cilium Discussion
  - startTime: 6768
    title: 'Theory: Cilium Policy and Broken Control Plane'
  - startTime: 6786
    title: Andy Reveals Break Got Away From Him
  - startTime: 6953
    title: Considering Rebooting the Node
  - startTime: 6997
    title: Disabling Kubelet and Rebooting
  - startTime: 7014
    title: 'Andy Explains Intentional Break (Read-Only FS, Etcd)'
  - startTime: 7207
    title: Andy's Malicious API Server Code Revealed
  - startTime: 7260
    title: 'Realization: Networking Broken During Setup'
  - startTime: 7394
    title: Checking Node Status Post-Reboot
  - startTime: 7443
    title: 'Node SSH Accessible, Teleport Not Yet'
  - startTime: 7473
    title: Recalling the Fake Kubectl
  - startTime: 7507
    title: Teleport Relies on CubeVip BGP
  - startTime: 7536
    title: Cilium BGP Enabled
  - startTime: 7572
    title: Starting Kubelet to Restore Teleport Access
  - startTime: 7695
    title: Teleport Access Restored
  - startTime: 7827
    title: Checking Host File for DNS Hijack
  - startTime: 7874
    title: Identifying Host File DNS Hijack
  - startTime: 7910
    title: Fixing Host File and Restarting Services
  - startTime: 7944
    title: API Server Is Running
  - startTime: 7980
    title: Application Still Broken
  - startTime: 8066
    title: Debugging CoreDNS Issues
  - startTime: 8135
    title: 'Hint: Check CNI (Cilium) Configuration'
  - startTime: 8182
    title: Locating and Reviewing Cilium ConfigMap
  - startTime: 8227
    title: Debugging Cilium Config
  - startTime: 8321
    title: Identifying IPV4 Masquerade Issue in Cilium Config
  - startTime: 8348
    title: Fixing IPV4 Masquerade in Cilium Config
  - startTime: 8418
    title: Checking Other Cilium Configs
  - startTime: 8443
    title: Cilium Status and Rollout
  - startTime: 8538
    title: Andy's Kubectl Namespace Easter Egg
  - startTime: 8559
    title: 'Cilium Working, CoreDNS Still Broken'
  - startTime: 8590
    title: Reviewing CoreDNS ConfigMap
  - startTime: 8740
    title: Checking Kubelet DNS Configuration
  - startTime: 9095
    title: Exec into Application Pod for DNS Check
  - startTime: 9171
    title: Checking CoreDNS Service IP
  - startTime: 9304
    title: Switching to Worker Nodes to Debug DNS
  - startTime: 9359
    title: Discovering Read-Only Filesystem on Worker
  - startTime: 9411
    title: Andy Confirms Read-Only Issue
  - startTime: 9475
    title: Attempting FS Check on Worker Node
  - startTime: 9510
    title: Fixing Kubelet DNS Config on Worker
  - startTime: 9546
    title: Rebooting Worker Node After FS Check Attempt
  - startTime: 9610
    title: Cordoning Off Failed Worker Node
  - startTime: 9636
    title: CoreDNS Pods Coming Up
  - startTime: 9660
    title: Restarting Application Pod
  - startTime: 9722
    title: Application Working (Andy's Cluster Fixed)
  - startTime: 9732
    title: Discussion and Conclusion
duration: 6325
guests:
  - rachel-leekin
  - andy-holtzmann
  - software-math-guy
resources:
  - title: Rawkode Academy Discord server
    category: other
    evidence_quote: you can join us on the Discord server available at Rawkode.chat.
    confidence: medium
  - title: Teleport sponsor link
    category: other
    evidence_quote: Please check out Rawkode.liveteleport
    confidence: medium
---

