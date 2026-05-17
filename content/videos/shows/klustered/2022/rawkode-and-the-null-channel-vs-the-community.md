---
id: l87s0mff9plb3tn1r8b1l3ie
slug: rawkode-and-the-null-channel-vs-the-community
title: Rawkode & The Null Channel Vs. The Community
description: >-
  Rawkode teams up with Marek Houns (The Null Channel) to debug two
  community-submitted broken clusters featuring a fake kubelet binary, a
  restricted-bash shell, a custom Wordle game, blocked PATH tricks, etcd cert
  trust failures, and a kernel namespace limit.
publishedAt: 2022-04-21T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - containerd
  - etcd
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 123
    title: Introduction
  - startTime: 143
    title: Housekeeping & Sponsors
  - startTime: 240
    title: 'Guest Introduction: Marek Houns (The Null Channel)'
  - startTime: 364
    title: Tackling Kevin's Cluster (The First Break)
  - startTime: 398
    title: Initial Cluster Check & Node Status
  - startTime: 722
    title: Debugging the Control Plane Node (NotReady)
  - startTime: 783
    title: Investigating the Kubelet Issue
  - startTime: 1038
    title: Identifying the "Mooplit" (Fake Kubelet Binary)
  - startTime: 1126
    title: Systemd/Systemctl Issues
  - startTime: 1146
    title: Reinstalling Systemd
  - startTime: 1261
    title: Kubelet Logging & Configuration Errors
  - startTime: 1324
    title: Finding the "Mid Bloop" & RUN_ONCE
  - startTime: 1495
    title: 'Kubelet Crash Loop: Invalid Flag'
  - startTime: 1546
    title: 'Fixing Kubelet Unit File (RUN_ONCE, Bad Flag)'
  - startTime: 1584
    title: 'Kevin''s Cluster: Control Plane Ready'
  - startTime: 1650
    title: Tackling Russell's Cluster (The Second Challenge)
  - startTime: 1678
    title: Restricted Shell & Speak-and-Spell Game
  - startTime: 1908
    title: Attempting to Fix User Shell via /etc/passwd
  - startTime: 1940
    title: Reconnection Issues & File Persistence Problem
  - startTime: 2051
    title: Identifying Restricted Bash (Rbash)
  - startTime: 2165
    title: Escaping Rbash via Sudo
  - startTime: 2203
    title: Replacing the Custom Shell Binary
  - startTime: 2297
    title: 'Stage 2: Auto-Logout & .profile'
  - startTime: 2463
    title: Fixing Auto-Logout (.profile Cleanup)
  - startTime: 2530
    title: Gaining Full Root Shell Access
  - startTime: 2575
    title: 'Russell''s Cluster: Control Plane Missing'
  - startTime: 2591
    title: 'Missing Binaries (curl, apt-get) & PATH Issues'
  - startTime: 2868
    title: Identifying the '9cat' Output Interference
  - startTime: 3156
    title: Fixing PATH (Resolving 9cat)
  - startTime: 3196
    title: Kubelet Certificate Errors
  - startTime: 3621
    title: Containerd & OCI Runtime Issues
  - startTime: 4082
    title: Debugging OCI Runtime Error ("Unknown Container ID")
  - startTime: 4337
    title: Discovering Containers in Kubernetes Namespace
  - startTime: 5180
    title: Identifying the Kernel Namespace Limit (sysctl)
  - startTime: 5259
    title: Fixing Kernel Namespace Limit
  - startTime: 5405
    title: 'Russell''s Cluster: Control Plane Ready'
  - startTime: 5432
    title: Worker Node Not Ready & API Server/Etcd Cert Issue
  - startTime: 5532
    title: Regenerating Kubernetes Certificates (kubeadm)
  - startTime: 5708
    title: Continued Certificate Issues & Etcd Logs
  - startTime: 6019
    title: Debugging Etcd Trust Error ("Unknown Authority")
  - startTime: 6368
    title: Fixing API Server Manifest (Adding etcd-cafile)
  - startTime: 6658
    title: 'Control Plane Ready, Worker Still NotReady'
  - startTime: 6670
    title: Regenerating admin.conf
  - startTime: 6840
    title: Tackling the Worker Node
  - startTime: 6855
    title: The Worker Node Wordle Game
  - startTime: 6925
    title: Playing the Custom Wordle
  - startTime: 7103
    title: Escaping Wordle
  - startTime: 7441
    title: 'Worker Debugging: Connection Refused'
  - startTime: 7459
    title: Re-joining Worker to Cluster
  - startTime: 7621
    title: Fixing Worker Route Issue (Blackhole)
  - startTime: 7667
    title: Debugging Worker Join Token/Config Map
  - startTime: 8237
    title: Manual Pod Scheduling (Temporary Workaround)
  - startTime: 8545
    title: Worker Node Becomes Ready (Root Issue Resolved)
  - startTime: 8613
    title: Redeploying Application Pod
  - startTime: 8650
    title: Wrap-up & Conclusion
duration: 8754
guests:
  - marek-counts
resources:
  - title: Teleport sponsor landing page
    type: url
    url: 'https://rawkode.live/teleport'
    category: other
  - title: Equinix Metal sponsor landing page
    type: url
    url: 'https://rawkode.live/metal'
    category: other
  - title: Rawkode Academy T-shirt competition page
    type: url
    url: 'https://rawkode.live/win'
    category: other
---

