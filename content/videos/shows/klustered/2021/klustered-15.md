---
id: klustered-15
slug: klustered-15
title: 'Klustered #15'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" #Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - This Video\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n03:30 - Cluster 33 by Marek Counts (@TheNullChannel)\n51:00 - Cluster 34 by Abdel Sghiouar (@boredabdel)\n\n\U0001F465 About the Guests\n\nMarek Counts\n\n  Opensource enthusiast, Self taught software engineer, poor excuse of a youtuber and father of 3. I love challenges, learning and sharing what I learn.\n\n\n\n\U0001F9E9 https://github.com/Klaven\n\n\n\nAbdel Sghiouar\n\n  \U0001F6A7\n\n\n\U0001F426 https://twitter.com/boredabdel\n\U0001F9E9 https://github.com/boredabdel\n\n\n\n\U0001F528 About the Technologies"
publishedAt: 2021-07-02T17:00:00.000Z
technologies: []
show: klustered
videoId: afzrby1hf2vpr1ist5fpg5sf
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 124
    title: Guest Introductions (Marek & Abdel)
  - startTime: 210
    title: Cluster 33 by Marek Counts (@TheNullChannel)
  - startTime: 221
    title: Debugging Cluster 33 (Marek's) - Initial Cluster Check
  - startTime: 335
    title: Cluster 33 Problem Description (Reading the README)
  - startTime: 410
    title: Debugging Node 58ghnk (Easy)
  - startTime: 464
    title: Kubelet & Containerd Issues on 58ghnk
  - startTime: 565
    title: Locating & Fixing Containerd Socket Path
  - startTime: 785
    title: Verifying Node Status (58ghnk Ready)
  - startTime: 861
    title: Debugging Node vx4 (Medium)
  - startTime: 896
    title: Fixing Containerd Config Again on vx4
  - startTime: 1041
    title: Debugging vx4 Node Status (Still Not Ready)
  - startTime: 1594
    title: 'Identifying Kubelet Config Problems (Memory, RunOnce)'
  - startTime: 1834
    title: Fixing Kubelet Config on vx4
  - startTime: 1887
    title: Verifying Node Status (vx4 Ready)
  - startTime: 2012
    title: Identifying Pod Scheduling & Admission Errors on vx4
  - startTime: 2181
    title: Debugging Node zedpr (Hard)
  - startTime: 2268
    title: Checking Kubelet Logs & Connectivity to API Server
  - startTime: 2407
    title: Checking Firewalls & Network Policies on zedpr
  - startTime: 2680
    title: Hint about Cilium & eBPF
  - startTime: 2700
    title: Finding Rogue eBPF Process on zedpr
  - startTime: 2920
    title: Identifying & Fixing eBPF Port Blocker
  - startTime: 3051
    title: Cluster 33 Recap & Intro Cluster 34 (Abdel's)
  - startTime: 3060
    title: Cluster 34 by Abdel Sghiouar (@boredabdel)
  - startTime: 3167
    title: Debugging Node 4wglm (Easy)
  - startTime: 3260
    title: Identifying & Fixing Disk Pressure Issue
  - startTime: 3415
    title: Verifying Node Status (4wglm Ready)
  - startTime: 3476
    title: Debugging Node ghp7k (Medium)
  - startTime: 3652
    title: Identifying & Fixing Unschedulable Taint
  - startTime: 3671
    title: Verifying Node Status (ghp7k Ready)
  - startTime: 3764
    title: Debugging Node zxr6q (Hard)
  - startTime: 3856
    title: Checking Kubelet Logs & Network Unavailable Condition
  - startTime: 4017
    title: Checking IP Tables & Kubelet Config Check
  - startTime: 4270
    title: Finding Misconfigured Kubelet Kubeconfig
  - startTime: 4877
    title: Checking Application Connectivity Issue (Clustered to Postgres)
  - startTime: 5030
    title: Debugging Database Connection
  - startTime: 5251
    title: Checking In-Pod DNS Resolution
  - startTime: 5430
    title: Finding & Fixing NetworkPolicy Blocking Egress
  - startTime: 5670
    title: NetworkPolicy Explanation
  - startTime: 5732
    title: Wrap Up & Conclusion
duration: 5872
---

