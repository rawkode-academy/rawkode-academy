---
id: tzx0c1g2al9hmwgrzmhzpoap
slug: klustered-teams-redhat-and-talos-systems
title: 'Klustered Teams: RedHat & Talos Systems'
description: >-
  Teams from Talos Systems and Red Hat break each other's Kubernetes clusters
  and race to fix them, debugging expired certificates, etcd quorum loss and
  snapshot restore, Cilium network policies, and a broken CNI loopback plugin.
whatYouWillLearn:
  - "Bypass broken cluster shell access with corrected kubectl binaries, shell setup, and session-specific teleport fixes."
  - "Diagnose expired Kubernetes certificates and control-plane disruption by tracking teleport loss, API server downtime, and etcd quorum status."
  - "Repair worker-node readiness and Cilium networking by fixing kubelet hostname mismatches and restoring the loopback CNI plugin."
publishedAt: 2021-07-15T17:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - cilium
  - etcd
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 105
    title: Introductions
  - startTime: 107
    title: Introduction and Housekeeping
  - startTime: 188
    title: Introducing Team Talos
  - startTime: 300
    title: Team Talos
  - startTime: 338
    title: 'Talos Team: Initial Cluster Check (Permission Denied)'
  - startTime: 610
    title: Bypassing Permissions with ld-linux
  - startTime: 975
    title: Replacing the kubectl Binary
  - startTime: 1149
    title: Fixing Shell Issues (Installing Fish)
  - startTime: 1203
    title: Identifying Certificate Expiration
  - startTime: 1241
    title: Attempting Certificate Renewal (kubadm)
  - startTime: 1348
    title: Restarting Control Plane Pods
  - startTime: 1456
    title: Talos Team Loses Teleport Access
  - startTime: 1564
    title: Regaining Access
  - startTime: 1653
    title: Debugging Kubelet and Static Pods
  - startTime: 1846
    title: Checking Application Status (Database Failed)
  - startTime: 1887
    title: Investigating Cilium Network Policies
  - startTime: 2427
    title: Identifying Default Cilium Policy
  - startTime: 2760
    title: Team RedHat
  - startTime: 3650
    title: Introducing Team Red Hat & Initial Cluster Check
  - startTime: 3701
    title: API Server Not Running
  - startTime: 3890
    title: Identifying the ETCD Issue
  - startTime: 4115
    title: ETCD Quorum Problems ("No Leader")
  - startTime: 4300
    title: Consulting Hints for ETCD
  - startTime: 4518
    title: 'Hint 1: Insufficient Quorum'
  - startTime: 4780
    title: Attempting to Remove Failed ETCD Member
  - startTime: 5132
    title: 'Hint 3: ETCD Snapshot Restore'
  - startTime: 5344
    title: Performing ETCD Snapshot Restore
  - startTime: 5610
    title: 'Kubectl Working, Worker Node Not Ready'
  - startTime: 5656
    title: Application (v1) is Accessible
  - startTime: 5672
    title: 'Red Hat Team: Attempting Application Upgrade'
  - startTime: 5755
    title: Application Pod Pending (Worker Node Issue)
  - startTime: 5969
    title: Consulting Hints for Worker Node
  - startTime: 6061
    title: 'Debugging Worker Node (Kubelet, Hostname)'
  - startTime: 6221
    title: Talos Team's Hostname Trick Revealed
  - startTime: 6258
    title: CNI Plugin Issue (Sandbox Error)
  - startTime: 6315
    title: Consulting Final Hints (Cilium CNI)
  - startTime: 6367
    title: Fixing the CNI Loopback Plugin
  - startTime: 6404
    title: Rescheduling the Application Pod
  - startTime: 6481
    title: Application (v2) is Working!
  - startTime: 6490
    title: Post-Challenge Discussion and Wrap-up
duration: 6609
guests:
  - andrewrynhard
  - smira
  - rsmitty
  - ulexus
  - cblecker
  - jharrington22
  - jeefy
resources:
  - title: Teleport sponsor page
    type: url
    url: 'https://rawkode.live/Teleport'
    category: other
  - title: Rawkode Academy Discord server
    type: url
    url: 'https://rawkode.chat'
    category: other
---
