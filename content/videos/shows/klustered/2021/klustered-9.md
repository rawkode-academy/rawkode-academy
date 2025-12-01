---
id: klustered-9
slug: klustered-9
title: 'Klustered #9'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\nHello\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - This Video\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n01:23 - Introductions\n03:50 - Kluster 17 - Broken by Sascha Grunert\n46:55 - Kluster 18 - Broken by Billie Cleek\n01:10:00 - Kluster 17 Revisited\n\n\U0001F465 About the Guests\n\nMarcos Nils\n\n  Principal @ Wildlife   | X-Ops Head @ ▲  | X-Infra lead @ MELI | Docker Captain  | PWD and OSS\n\n\n\U0001F426 https://twitter.com/marcosnils\n\U0001F9E9 https://github.com/marcosnils\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/rawkode/klustered"
publishedAt: 2021-04-16T17:00:00.000Z
technologies: []
show: klustered
videoId: weym8gw0c6g1ol7qjtde1521
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 83
    title: Introductions
  - startTime: 84
    title: Introduction & Show Overview
  - startTime: 176
    title: Introducing Co-Host Marcos
  - startTime: 227
    title: Starting Cluster 17 Troubleshooting
  - startTime: 230
    title: Kluster 17 - Broken by Sascha Grunert
  - startTime: 283
    title: Initial Cluster 17 Checks
  - startTime: 457
    title: Cluster 17 Application Upgrade Failure (v2)
  - startTime: 513
    title: Debugging OCI Runtime Error ('Honk')
  - startTime: 603
    title: Investigating Cluster 17 Configurations
  - startTime: 1148
    title: Investigating Node-Specific Issues
  - startTime: 1318
    title: Discovering Rogue 'Node Debugger' Pod
  - startTime: 1444
    title: Examining Rogue Pod Manifest
  - startTime: 1533
    title: Debugging Inside Rogue Pod
  - startTime: 1600
    title: Finding Suspicious Host File
  - startTime: 1670
    title: Analyzing Rogue Killing Script
  - startTime: 1709
    title: Stopping Rogue Service & Pods
  - startTime: 1936
    title: Retesting Application Upgrade (Cluster 17)
  - startTime: 1995
    title: 'Cluster 17 App Works, ''Honk'' Remains Mystery'
  - startTime: 2800
    title: Switching to Cluster 18
  - startTime: 2815
    title: Kluster 18 - Broken by Billie Cleek
  - startTime: 2836
    title: Cluster 18 Initial Diagnosis (API Server Down)
  - startTime: 2948
    title: Debugging Control Plane Components (Cluster 18)
  - startTime: 3279
    title: Cluster 18 Application Networking Issue
  - startTime: 3348
    title: Debugging Networking from App Pod
  - startTime: 3407
    title: Identifying DNS Issue (Cluster 18)
  - startTime: 3455
    title: Checking CoreDNS Configuration
  - startTime: 3510
    title: 'Found: CoreDNS NXDOMAIN Rule'
  - startTime: 3527
    title: Fixing CoreDNS
  - startTime: 3659
    title: Discovering Mutating Webhook Issue
  - startTime: 3940
    title: Deleting Problematic Mutating Webhook
  - startTime: 3963
    title: Verifying Cluster 18 Control Plane Health
  - startTime: 4097
    title: Cluster 18 App Connectivity & Upgrade Test
  - startTime: 4120
    title: Cluster 18 Resolved
  - startTime: 4200
    title: Kluster 17 Revisited
  - startTime: 4213
    title: Revisiting Cluster 17 ('Honk' Mystery)
  - startTime: 4366
    title: Searching for 'Honk' Binary/Config
  - startTime: 4558
    title: Debugging Containerd on Worker Node
  - startTime: 4905
    title: Inspecting Containerd Configuration
  - startTime: 5062
    title: Cluster 17 Conclusion (BPF Suspected)
  - startTime: 5238
    title: Wrap-up & Thank You
duration: 5373
---

