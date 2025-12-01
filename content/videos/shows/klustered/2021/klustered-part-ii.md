---
id: klustered-part-ii
slug: klustered-part-ii
title: Klustered (Part II)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nKluster 004 was broken by Jason DeTiberus (https://twitter.com/detiber of Equix Metal\nKlister 005 was broken by Walid Shaari (https://twitter.com/walidshaari).\nThe post-mortems are available at https://gitlab.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - This Video\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n06:45 - Debugging the Wrong / Working Kluster (Oops)\n17:55 - Kluster 004 - Broken by Jason DeTiberus (@detiber)\n57:20 - Kluster 005 - Broken by Walid Shaari (@walidshaari)\n\n\U0001F465 About the Guests\n\nDan Finneran\n\n  Making a racket @EquinixMetal. X(Heptio/Docker/HPE/ESA)\n\n\n\U0001F426 https://twitter.com/thebsdbox\n\U0001F9E9 https://github.com/thebsdbox\n\U0001F30F https://thebsdbox.co.uk/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-02-26T17:00:00.000Z
technologies: []
show: klustered
videoId: j6uehaw57ynwqnbkjs3m1to6
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 71
    title: Introduction and Guest Welcome (Dan Finnerin)
  - startTime: 176
    title: Recap of Last Week's Clustered Challenges
  - startTime: 405
    title: Debugging the Wrong / Working Kluster (Oops)
  - startTime: 460
    title: Starting with Jason's Cluster (Cluster 3)
  - startTime: 608
    title: 'Initial Cluster 3 Checks (Workload, Pods)'
  - startTime: 1007
    title: 'Realization: Cluster 3 is Healthy'
  - startTime: 1072
    title: Switching to Waleed's Broken Cluster (Cluster 5)
  - startTime: 1075
    title: Kluster 004 - Broken by Jason DeTiberus (@detiber)
  - startTime: 1105
    title: 'Cluster 5 Initial State: Unready Nodes'
  - startTime: 1141
    title: 'Debugging Node Issues: Checking Kubelet Status and Logs'
  - startTime: 1337
    title: ETCD and API Server Issues on Node 1
  - startTime: 1539
    title: Examining ETCD Manifest (Node 1)
  - startTime: 1841
    title: 'Identified & Fixed: ETCD Version Mismatch (Node 1)'
  - startTime: 1999
    title: Checking API Server After ETCD Fix Attempt
  - startTime: 2165
    title: Debugging Worker Node Kubelet Issue
  - startTime: 2300
    title: 'Identified: Kubelet Unknown Flag (`bootstrap-kubeconfig`)'
  - startTime: 2392
    title: Examining Kubelet Configuration Files
  - startTime: 2435
    title: Fixing Kubelet Configuration (Removing Flag)
  - startTime: 3027
    title: 'Hint: Check Kubelet Version'
  - startTime: 3290
    title: 'Identified & Fixed: Old Kubelet Binary Version'
  - startTime: 3383
    title: Cluster 5 Nodes Becoming Ready (After Kubelet Fix)
  - startTime: 3440
    title: Kluster 005 - Broken by Walid Shaari (@walidshaari)
  - startTime: 3510
    title: Reading Cluster 5 Readme Hint
  - startTime: 3595
    title: Cluster 5 Status After Initial Node Fixes
  - startTime: 3725
    title: '`kubectl get nodes` Times Out (Investigating ETCD)'
  - startTime: 3783
    title: Examining ETCD Logs (Node 1)
  - startTime: 3815
    title: 'Identified: ETCD "No Space" Alarm'
  - startTime: 3849
    title: Examining ETCD Manifest for Volume Configuration
  - startTime: 4213
    title: Using ETCD CTL to Query Status
  - startTime: 4315
    title: 'ETCD CTL Status Shows Healthy, But Alarm Exists'
  - startTime: 4385
    title: Getting ETCD DB Size & Attempting Compaction
  - startTime: 4967
    title: Hint & Examining ETCD Manifest for Quota
  - startTime: 5091
    title: Fixing ETCD Quota Setting
  - startTime: 5471
    title: ETCD Logs Still Show "No Space" Alarm
  - startTime: 5697
    title: 'Hint: Check ETCD Alarms'
  - startTime: 5767
    title: Disarming ETCD Alarms
  - startTime: 5796
    title: ETCD Status Healthy After Alarm Fix
  - startTime: 5810
    title: Cluster 5 Overall Status Check
  - startTime: 5939
    title: Testing Internal Pod Connectivity (Failure)
  - startTime: 5981
    title: 'Identified: Missing CoreDNS and Control Plane Pods'
  - startTime: 6204
    title: Troubleshooting Missing Control Plane Pods (Logs)
  - startTime: 6663
    title: 'Hint: Check Network Policies'
  - startTime: 6695
    title: 'Identified & Deleted: "Block All" Network Policy'
  - startTime: 6751
    title: 'Hint: Check Pod Security Policies'
  - startTime: 6795
    title: 'Identified & Deleted: PSP Affecting Static Pods'
  - startTime: 6878
    title: 'Final Hint: Check Kernel Settings (Sysctl)'
  - startTime: 6961
    title: Conceding Failure on Final Issue
  - startTime: 6978
    title: Conclusion and Wrap-up
duration: 7085
---

