---
id: szryg6h4y89lh067p26a2g1f
slug: klustered-19
title: 'Klustered #19'
description: >-
  Matt Turner and Borko debug two broken Kubernetes clusters live. Issues
  include a missing API server, etcd resource limits, a decoy DaemonSet, DNS
  policy, AppArmor blocking kubectl, etcd encryption misconfig, and a malicious
  Postgres startup command.
publishedAt: 2021-09-09T17:30:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - etcd
  - postgresql
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 54
    title: Introduction & Episode Overview
  - startTime: 72
    title: Channel Housekeeping & Discord
  - startTime: 118
    title: Sponsor Mention (Teleport)
  - startTime: 162
    title: Guest Introductions
  - startTime: 243
    title: 'Debugging Matt''s Cluster: Initial Checks'
  - startTime: 371
    title: API Server Not Running
  - startTime: 415
    title: Checking API Server Manifest & Logs
  - startTime: 640
    title: Fixing Etcd Resource Limits
  - startTime: 700
    title: 'Control Plane Stable, Checking Application Pods'
  - startTime: 855
    title: Identifying and Deleting Decoy Daemonset
  - startTime: 1270
    title: Investigating Clustered & Postgres Pods
  - startTime: 1491
    title: Ephemeral Storage Warning on Node
  - startTime: 2036
    title: Checking Worker Node & Debugging Disk Issue (Matt's Reveal)
  - startTime: 2172
    title: Postgres Pod Pending (Scheduler Issue)
  - startTime: 2195
    title: Bypassing Scheduler with NodeName
  - startTime: 2271
    title: Clustered App Cannot Connect to Postgres
  - startTime: 2345
    title: Investigating DNS Issue
  - startTime: 2559
    title: Fixing Kubelet DNS Policy
  - startTime: 2670
    title: Matt's Cluster Fixed & Explanation of Breaks
  - startTime: 2930
    title: 'Debugging Barco''s Cluster: Initial Access Issue (kubectl)'
  - startTime: 3070
    title: 'Investigating kubectl Execution Error (strace, permissions)'
  - startTime: 3375
    title: Identifying AppArmor Restriction
  - startTime: 3525
    title: Control Plane Components Flapping
  - startTime: 3660
    title: Investigating API Server Flapping Logs
  - startTime: 3780
    title: Identifying Etcd Encryption Configuration
  - startTime: 3900
    title: Debugging Etcd Access & "Unable to transform key"
  - startTime: 4590
    title: Identifying Unencrypted Data in Etcd
  - startTime: 4950
    title: Fixing Etcd Encryption Config (Adding Identity)
  - startTime: 5104
    title: API Server Becomes Stable
  - startTime: 5125
    title: Debugging Postgres Authentication Error
  - startTime: 5330
    title: Identifying Malicious Postgres Startup Command
  - startTime: 5355
    title: Fixing Postgres Startup Command
  - startTime: 5548
    title: Barco's Cluster Fixed
  - startTime: 5560
    title: Wrap Up & Explanations of Breaks
  - startTime: 5674
    title: Final Words & Thanks
duration: 5734
guests:
  - borko-djurkovic
  - matt-turner
resources:
  - title: Teleport clustered sponsor link
    type: url
    url: 'https://rawkode.live/teleport'
    category: other
  - title: commandnotfound.com
    type: url
    url: 'https://commandnotfound.com'
    category: other
  - title: Rawkode Discord
    type: url
    url: 'https://rawkode.chat'
    category: other
---

