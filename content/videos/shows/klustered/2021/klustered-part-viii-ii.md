---
id: klustered-part-viii-ii
slug: klustered-part-viii-ii
title: Klustered (Part VIII-II)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - This Video\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n00:20 - Introductions\n01:30 - Kluster 015\n\n\U0001F465 About the Guests\n\nNoel Georgi\n\n  Bio\n\n\n\U0001F426 https://twitter.com/noelgeorgi\n\U0001F9E9 https://github.com/frezbo\n\U0001F30F https://resume.frezbo.dev/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/rawkode/klustered"
publishedAt: 2021-04-10T17:00:00.000Z
technologies: []
show: klustered
videoId: e0osaaguckezvjzf42dm6zbc
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 20
    title: Introductions
  - startTime: 22
    title: Introduction and Previous Recap
  - startTime: 84
    title: API Server Fix (Resource Limits) Recap
  - startTime: 90
    title: Kluster 015
  - startTime: 208
    title: Initial Pod State (Completed/Init) Investigation
  - startTime: 432
    title: Investigating Cilium (CNI) Pods
  - startTime: 601
    title: Debugging Init Containers and Sandbox Errors
  - startTime: 746
    title: Using crictl to Inspect Containerd
  - startTime: 1012
    title: Corrupted Cilium CNI Binary Found
  - startTime: 1311
    title: Replacing the CNI Binary on Control Plane
  - startTime: 1620
    title: Persistent Sandbox Issues & Containerd Debugging
  - startTime: 2720
    title: Comparing Containerd Across Nodes (Shim/Cgroup Differences)
  - startTime: 3147
    title: Identifying Malicious `systemd-collector-d` Binary
  - startTime: 4218
    title: Removing Malicious Binaries & Restarting Services
  - startTime: 4295
    title: Verifying Containerd Fix & CNI Status
  - startTime: 4722
    title: 'New Issue: API Server Communication Problems'
  - startTime: 5036
    title: Checking ETCD & API Server Logs
  - startTime: 5296
    title: Debugging Rawkode Application Pods
  - startTime: 5556
    title: Fixing Rawkode Service Configuration
  - startTime: 5676
    title: Cluster Fixed & Conclusion
duration: 5756
---

