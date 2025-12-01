---
id: klustered-part-i
slug: klustered-part-i
title: Klustered (Part I)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nKluster 001 was broken by Lee Briggs (https://twitter.com/briggsl) of Pulumi\nKlister 002 was broken by Dan Finneran (https://twitter.com/thebsdbox) of Equinix Metal.\nThe post-mortems are available at https://gitlab.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - This Video\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:30 - Introductions\n04:00 - Kluster 001 by @briggsl\n29:50 - Kluster 002 by @thebsdbox\n\n\U0001F465 About the Guests\n\nWalid Shaari\n\n  DevOps Cloud-native Ansible Puppet Kubernetes Linux CKA CKAD RHCA II \n\n\n\U0001F426 https://twitter.com/walidshaari\n\U0001F9E9 https://github.com/walidshaari\n\U0001F30F https://github.com/walidshaari\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://gitlab.com/rawkode/klustered/-/blob/main/001/README.md\nhttps://gitlab.com/rawkode/klustered/-/blob/main/002/README.md"
publishedAt: 2021-02-19T17:00:00.000Z
technologies: []
show: klustered
videoId: nbmmmzl4etklri5aruv7hbgq
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 38
    title: Introduction & Guest Welcome
  - startTime: 100
    title: 'Setting the Scene: The Broken Clusters'
  - startTime: 155
    title: Initial Debugging Plan
  - startTime: 225
    title: Starting with Cluster 1 (Lee's Cluster)
  - startTime: 240
    title: Kluster 001 by @briggsl
  - startTime: 280
    title: Initial Health Checks (Cluster 1)
  - startTime: 340
    title: Testing Pod Scheduling
  - startTime: 407
    title: Scheduler Appears to be Working
  - startTime: 429
    title: Investigating Component Status
  - startTime: 520
    title: Port Discrepancy in Component Status
  - startTime: 594
    title: Examining Control Plane Manifests on Node
  - startTime: 1790
    title: Kluster 002 by @thebsdbox
  - startTime: 4315
    title: 'Hypothesis: Missing Port in Manifest'
  - startTime: 4596
    title: Verifying Listening Ports with Netstat
  - startTime: 4650
    title: Identifying the CNI Problem (Cilium)
  - startTime: 4719
    title: Debugging Cilium DaemonSet & Logs
  - startTime: 4851
    title: Fixing Cilium Configuration (iptables rule)
  - startTime: 5056
    title: Verifying Cluster 1 Health & Workload
  - startTime: 5175
    title: Cluster 1 Component Status Red Herring?
  - startTime: 5223
    title: Switching to Cluster 2 (Dan's Cluster)
  - startTime: 5237
    title: 'Initial Check (Cluster 2): API Server Down'
  - startTime: 5436
    title: Attempting Node Access
  - startTime: 5747
    title: Gaining Node Access via Port 2222
  - startTime: 5838
    title: Investigating Kubelet Status
  - startTime: 5974
    title: Identifying the Swap Problem
  - startTime: 6035
    title: Fixing Swap on One Node
  - startTime: 6162
    title: Realizing Swap Problem on All Nodes
  - startTime: 6510
    title: Disabling Swap on All Control Plane Nodes
  - startTime: 6549
    title: API Server Status After Swap Fix
  - startTime: 6603
    title: Firewall Interference (UFW)
  - startTime: 6632
    title: API Server Disappears Again
  - startTime: 6702
    title: Investigating API Server Logs & etcd Connection
  - startTime: 7051
    title: Fixing API Server etcd Endpoint Configuration
  - startTime: 7208
    title: API Server & Cluster 2 Restored
  - startTime: 7292
    title: Addressing CoreDNS and CIDR Problem
  - startTime: 7421
    title: Fixing Cluster CIDR in Kubeadm Config
  - startTime: 7513
    title: Final Verification (Cluster 2)
  - startTime: 7565
    title: 'Discussion, Realism of Problems, and Conclusion'
duration: 5715
---

