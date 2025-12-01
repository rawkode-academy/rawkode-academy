---
id: klustered-18
slug: klustered-18
title: 'Klustered #18'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" #Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - This Video\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:40 - Introductions\n04:00 - Cluster by Eric Smalling\n30:00 - Cluster by Carlos Santana\n\n\U0001F465 About the Guests\n\nEric Smalling\n\n  .\n\n\n\U0001F426 https://twitter.com/ericsmalling\n\U0001F9E9 https://github.com/ericsmalling\n\n\n\nCarlos Santana\n\n  .\n\n\n\U0001F426 https://twitter.com/csantanapr\n\U0001F9E9 https://github.com/csantanapr\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-08-27T17:00:00.000Z
technologies: []
show: klustered
videoId: llclhowidfbrvg93zt05v77m
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 40
    title: Introductions
  - startTime: 61
    title: Introduction and Housekeeping
  - startTime: 112
    title: Guest Introductions (Eric & Carlos)
  - startTime: 231
    title: 'Challenge 1: Fixing Eric''s Cluster'
  - startTime: 240
    title: Cluster by Eric Smalling
  - startTime: 268
    title: Initial Cluster Check & Setup
  - startTime: 408
    title: Investigating Unexpected Static Pods
  - startTime: 533
    title: Diagnosing Service Connectivity
  - startTime: 738
    title: ZomboCom Discovery
  - startTime: 988
    title: Removing Static Pod Manifests
  - startTime: 1011
    title: Worker Node Connectivity Issue
  - startTime: 1052
    title: Removing Static Manifests via SSH
  - startTime: 1098
    title: Scaling Up Deployment
  - startTime: 1137
    title: Diagnosing Image Pull Error
  - startTime: 1291
    title: Fixing DNS and IP Tables
  - startTime: 1492
    title: Fixing IP Tables on Workers
  - startTime: 1555
    title: Deployment Pod Running
  - startTime: 1564
    title: Upgrade to v2 and App Check
  - startTime: 1635
    title: Eric's Hacks Revealed
  - startTime: 1800
    title: Cluster by Carlos Santana
  - startTime: 1871
    title: Cluster Check & Setup
  - startTime: 1971
    title: Diagnosing Stopped Kubelets
  - startTime: 2039
    title: Starting Kubelets
  - startTime: 2106
    title: Diagnosing Pending Pod (Wrong Image)
  - startTime: 2265
    title: Pod Image Mutation Found
  - startTime: 2400
    title: Discovering Missing Scheduler
  - startTime: 2799
    title: Fixing Missing Scheduler
  - startTime: 2903
    title: Removing Node Taints
  - startTime: 2930
    title: Image Still Wrong
  - startTime: 3000
    title: Diagnosing Database Crashes
  - startTime: 3076
    title: Diagnosing App Networking (Network Policy)
  - startTime: 3171
    title: Fixing Network Policy
  - startTime: 3227
    title: Database Image Wrong
  - startTime: 3444
    title: Using Hints
  - startTime: 3797
    title: Malicious kubectl Alias Found
  - startTime: 3940
    title: Deleting Mutating Webhook
  - startTime: 4008
    title: Pods Running Correctly
  - startTime: 4090
    title: Upgrade to v2 and App Check
  - startTime: 4158
    title: Carlos's Hacks Revealed
  - startTime: 4210
    title: Conclusion
duration: 4306
---

