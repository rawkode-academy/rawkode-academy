---
id: klustered-17
slug: klustered-17
title: 'Klustered #17'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" #Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:42 - Introductions\n06:45 - Cluster by Ádám Szücs-Mátyás\n39:15 - Cluster by William Lightning\n\n\U0001F465 About the Guests\n\nÁdám Szücs-Mátyás\n\n  .\n\n\n\U0001F426 https://twitter.com/szucsitg\n\U0001F9E9 https://github.com/szucsitg\n\n\n\nWilliam Lightning\n\n  Polyglot programmer working as a Systems Architect at @fuelmedical. Working on cool things like k8s and laravel\n\n\n\U0001F426 https://twitter.com/kassah\n\U0001F9E9 https://github.com/kassah\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-08-20T17:00:00.000Z
technologies: []
show: klustered
videoId: xn5lyqrxw1a9e6c39zsi17s2
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 102
    title: Introductions
  - startTime: 103
    title: 'Intro, Housekeeping & Sponsor'
  - startTime: 181
    title: Guest Introductions
  - startTime: 252
    title: Is it Scary or Fun to Break Clusters?
  - startTime: 402
    title: Debugging Adam's Cluster (Part 1)
  - startTime: 405
    title: Cluster by Ádám Szücs-Mátyás
  - startTime: 450
    title: 'Initial Checks: Nodes Unschedulable'
  - startTime: 510
    title: Application is Down
  - startTime: 535
    title: Incorrect Application Image
  - startTime: 702
    title: Fixing Unschedulable Nodes
  - startTime: 957
    title: Database Connectivity Issue
  - startTime: 968
    title: Debugging Postgres
  - startTime: 1250
    title: Checking Network Policies
  - startTime: 1390
    title: Network Debugging Tools & Failed Ping
  - startTime: 1866
    title: DNS Resolution Failure
  - startTime: 2004
    title: Fixing CoreDNS Config
  - startTime: 2057
    title: Restarting CoreDNS & App Works
  - startTime: 2171
    title: Upgrading Application to v2
  - startTime: 2237
    title: Adam Reveals His Breaks
  - startTime: 2344
    title: Debugging William's Cluster (Part 2)
  - startTime: 2355
    title: Cluster by William Lightning
  - startTime: 2470
    title: Control Plane is Down
  - startTime: 2510
    title: Investigating Static Manifests
  - startTime: 2635
    title: Flushing IP Tables
  - startTime: 2761
    title: 'API Server Error: Cannot Reach etcd'
  - startTime: 2818
    title: etcd Permissions Issue
  - startTime: 2889
    title: etcd Disk Full Issue
  - startTime: 3007
    title: Fixing etcd File Permissions
  - startTime: 3258
    title: Disk Space & Loopback Mount Issue
  - startTime: 3476
    title: Searching for etcd Backup
  - startTime: 3590
    title: Restoring etcd Data & Control Plane Fixed
  - startTime: 3761
    title: Nodes Not Ready (CNI)
  - startTime: 3833
    title: Scheduler Crashing (Volume Mount Issue)
  - startTime: 4134
    title: Manually Scheduling Pods & App Works
  - startTime: 4490
    title: William & Adam Reveal Breaks
  - startTime: 4630
    title: Conclusion
duration: 4709
---

