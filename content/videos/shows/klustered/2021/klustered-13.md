---
id: klustered-13
slug: klustered-13
title: 'Klustered #13'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\n#KubernetesTutorial #LiveDebugging\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - This Video\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:00 - Viewer Comments\n00:00 - Viewer Comments\n\n\U0001F465 About the Guests\n\nMarques Johansson\n\n  .\n\n\n\U0001F426 https://twitter.com/displague\n\U0001F9E9 https://github.com/displague\n\n\n\nMahmoud Saada\n\n  Certified Kubernetes administrator, experienced in working with cloud native applications and infrastructure in both start up and enterprise environments. Over the past years worked as a software and site reliability engineer for a variety of industries such as HR, AI and finance. Developed a deep passion for delivering outstanding experiences for customers and engineers. Speaks at meetups such as Docker and Uber’s Distributed Tracing in NYC.\n\n\n\U0001F426 https://twitter.com/saadazzz\n\U0001F9E9 https://github.com/saada\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-06-04T17:00:00.000Z
technologies: []
show: klustered
videoId: kmhmcc41uglftsqr66vbo0di
chapters:
  - startTime: 0
    title: Viewer Comments
  - startTime: 98
    title: Introduction to Klustered
  - startTime: 107
    title: Housekeeping & Announcements
  - startTime: 148
    title: Guest Introductions (Mahmoud & Marcus)
  - startTime: 238
    title: Starting Cluster 1 Debugging (Marcus's Cluster)
  - startTime: 290
    title: Initial Cluster Checks & Scaling Deployment
  - startTime: 344
    title: Scaling Deployment & Observing Failure
  - startTime: 502
    title: Investigating Control Plane / Controller Manager
  - startTime: 676
    title: 'Analyzing Controller Manager Logs: Resource Limits'
  - startTime: 733
    title: Identifying & Deleting LimitRange
  - startTime: 860
    title: Teleport Disconnect / Session Issue 1
  - startTime: 915
    title: Teleport Recovers / Coincidence?
  - startTime: 966
    title: Debugging Image Pull BackOff (Bad Secret)
  - startTime: 1306
    title: Fixing Image Pull Secret & Pod Runs
  - startTime: 1390
    title: Finding Missing Database (StatefulSet)
  - startTime: 1438
    title: Scaling StatefulSet & New Scheduling/Quota Errors
  - startTime: 1558
    title: Debugging Resource Quota & Persistent Errors
  - startTime: 1641
    title: Debugging Node Scheduling (Taints & Selectors)
  - startTime: 1953
    title: Teleport Disconnect / Session Issue 2 & Removing Node Selector
  - startTime: 2159
    title: StatefulSet Pod Runs & Cluster 1 Appears Fixed
  - startTime: 2232
    title: Testing Application Access & Confirming App Version (Cluster 1 Fixed)
  - startTime: 2610
    title: Transition to Cluster 2 Debugging (Moody's Cluster)
  - startTime: 3905
    title: Fixing Controller Manager Image
  - startTime: 4087
    title: 'Restarting System Pods (Cilium, etc.)'
  - startTime: 4348
    title: Applying App Update (v2)
  - startTime: 4457
    title: Debugging Slow Image Pull & Final Fix
  - startTime: 4644
    title: Recap of Breaks & Conclusion
  - startTime: 16871
    title: Hint for Cluster 2
  - startTime: 17059
    title: 'Starting Cluster 2 Debugging: Widespread Failures'
  - startTime: 17773
    title: 'Debugging Cilium: Honky.io Image'
  - startTime: 18315
    title: Identifying Containerd Image Mirror Issue
  - startTime: 19413
    title: Modifying Containerd Config & Restarting on all Nodes
  - startTime: 20411
    title: 'Containerd Fixed: Cilium Pods Initializing'
  - startTime: 21483
    title: Investigating Persistent Honk Image Issue (Static Pod Manifest)
duration: 4953
---

