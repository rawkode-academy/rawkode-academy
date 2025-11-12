---
id: rawkode-and-the-null-channel-vs-the-community
slug: rawkode-and-the-null-channel-vs-the-community
title: Rawkode & The Null Channel Vs. The Community
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\". Learn more about Equinix Metal at https://rawkode.live/metal\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-04-21T17:00:00.000Z
technologies: []
show: klustered
videoId: l87s0mff9plb3tn1r8b1l3ie
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
---

