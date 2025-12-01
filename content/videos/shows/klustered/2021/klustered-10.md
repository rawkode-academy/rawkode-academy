---
id: klustered-10
slug: klustered-10
title: 'Klustered #10'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - This Video\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:55 - Introductions\n03:40 - Cluster by Walid Shaari\n29:40 - Cluster by Noel Georgi\n1:02:00 - Cluster by Rawkode\n\n\U0001F465 About the Guests\n\nWalid Shaari\n\n  DevOps Cloud-native Ansible Puppet Kubernetes Linux CKA CKAD RHCA II \n\n\n\U0001F426 https://twitter.com/walidshaari\n\U0001F9E9 https://github.com/walidshaari\n\U0001F30F https://github.com/walidshaari\n\n\nNoel Georgi\n\n  Bio\n\n\n\U0001F426 https://twitter.com/noelgeorgi\n\U0001F9E9 https://github.com/frezbo\n\U0001F30F https://resume.frezbo.dev/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-05-07T17:00:00.000Z
technologies: []
show: klustered
videoId: gkvfatiptx9zm9zmvcyipvt7
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 55
    title: Introductions
  - startTime: 74
    title: 'Housekeeping (Subscribe, Discord, Sponsors)'
  - startTime: 134
    title: Introducing Walid and Noel
  - startTime: 214
    title: Debugging Walid's Cluster (Cluster 19 Begins)
  - startTime: 220
    title: Cluster by Walid Shaari
  - startTime: 330
    title: Initial Cluster State & RBAC Issue (Describe nodes fails)
  - startTime: 423
    title: Fixing the Worker Kubelet (Restarting dead kubelet)
  - startTime: 1780
    title: Cluster by Noel Georgi
  - startTime: 3652
    title: Investigating Pod Pending State (Cilium/Postgres)
  - startTime: 3720
    title: Cluster by Rawkode
  - startTime: 3930
    title: 'Identifying Cluster-Level RBAC Issue (Can get, cannot describe)'
  - startTime: 4266
    title: Debugging RBAC Configuration and Roles
  - startTime: 4642
    title: Finding & Using the Admin Kubeconfig (.honk hint)
  - startTime: 4796
    title: Debugging the Kube Scheduler (Pods pending due to scheduler)
  - startTime: 5058
    title: Identifying Missing Scheduler Role
  - startTime: 5122
    title: Fixing Core RBAC via API Server Restart
  - startTime: 5366
    title: Walid's Cluster Fixed
  - startTime: 5383
    title: Debugging Noel's Cluster (Cluster 20 Begins)
  - startTime: 5469
    title: kubectl Binary Hijacked (honkctl alias found)
  - startTime: 5524
    title: >-
      Identifying the AlwaysDeny Admission Controller (Discussing finding the
      second plugin)
  - startTime: 5542
    title: Fixing the AlwaysDeny Admission Controller
  - startTime: 5605
    title: Post-Fix Discussion & Learnings
  - startTime: 5610
    title: Initial Pod State & Rollout Failure (Forbidden)
  - startTime: 5698
    title: Conclusion and Next Episodes
  - startTime: 5868
    title: Investigating Mutating Webhooks (Finding honk webhook)
  - startTime: 6239
    title: ImagePullBackOff Error (Incorrect image version)
  - startTime: 6417
    title: Debugging Port Forward Failure (Investigating Iptables)
  - startTime: 6747
    title: Mutating Webhook Causing Image Revert (Revisiting the webhook config)
  - startTime: 6858
    title: Containerd Registry Rewrite Issue (Image pull fails)
  - startTime: 7056
    title: Fixing Containerd Registry Configuration (Deleting hosts.toml)
  - startTime: 7200
    title: Debugging Coredns (Corefile Rewrite)
  - startTime: 7285
    title: Fixing Coredns Configuration
  - startTime: 7352
    title: Moving to David's Cluster (Cluster 21 Begins)
  - startTime: 7454
    title: Initial Cluster State & Slowness (API server timing out)
  - startTime: 7800
    title: Investigating API Server Errors & Missing Logs
  - startTime: 8161
    title: Fixing Log Directory Permissions
  - startTime: 8480
    title: Identifying the Source of Slowness (Throttling Proxy)
  - startTime: 8627
    title: Fixing the Throttling Proxy (Renamed SE Linux process)
  - startTime: 8666
    title: Pod Still Creating & Admission Denied (LimitRange forbidden)
duration: 5770
---

