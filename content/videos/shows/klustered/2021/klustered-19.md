---
id: klustered-19
slug: klustered-19
title: 'Klustered #19'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" #Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - This Video\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F465 About the Guests\n\nBorko Djurkovic\n\n  An independent consultant and contractor working primarily with public sector and government clients. Typically working in Cloud Architect or DevOps Engineer roles. Main focus is working with Kubernetes, AWS, and Azure.\n\n\n\U0001F426 https://twitter.com/borkod\n\U0001F9E9 https://github.com/borkod\n\U0001F30F https://www.b3o.ca/\n\n\nMatt Turner\n\n  Clouds , automation , Kubernetes (CKA) , Istio\n\n\n\U0001F426 https://twitter.com/mt165\n\U0001F9E9 https://github.com/mt165\n\U0001F30F https://mt165.co.uk/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-09-10T17:00:00.000Z
technologies: []
show: klustered
videoId: szryg6h4y89lh067p26a2g1f
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 54
    title: Introduction & Episode Overview
  - startTime: 72
    title: Channel Housekeeping & Discord
  - startTime: 118
    title: Sponsor Mention (Teleport)
  - startTime: 162
    title: Guest Introductions
  - startTime: 243
    title: 'Debugging Matt''s Cluster: Initial Checks'
  - startTime: 371
    title: API Server Not Running
  - startTime: 415
    title: Checking API Server Manifest & Logs
  - startTime: 640
    title: Fixing Etcd Resource Limits
  - startTime: 700
    title: 'Control Plane Stable, Checking Application Pods'
  - startTime: 855
    title: Identifying and Deleting Decoy Daemonset
  - startTime: 1270
    title: Investigating Clustered & Postgres Pods
  - startTime: 1491
    title: Ephemeral Storage Warning on Node
  - startTime: 2036
    title: Checking Worker Node & Debugging Disk Issue (Matt's Reveal)
  - startTime: 2172
    title: Postgres Pod Pending (Scheduler Issue)
  - startTime: 2195
    title: Bypassing Scheduler with NodeName
  - startTime: 2271
    title: Clustered App Cannot Connect to Postgres
  - startTime: 2345
    title: Investigating DNS Issue
  - startTime: 2559
    title: Fixing Kubelet DNS Policy
  - startTime: 2670
    title: Matt's Cluster Fixed & Explanation of Breaks
  - startTime: 2930
    title: 'Debugging Barco''s Cluster: Initial Access Issue (kubectl)'
  - startTime: 3070
    title: 'Investigating kubectl Execution Error (strace, permissions)'
  - startTime: 3375
    title: Identifying AppArmor Restriction
  - startTime: 3525
    title: Control Plane Components Flapping
  - startTime: 3660
    title: Investigating API Server Flapping Logs
  - startTime: 3780
    title: Identifying Etcd Encryption Configuration
  - startTime: 3900
    title: Debugging Etcd Access & "Unable to transform key"
  - startTime: 4590
    title: Identifying Unencrypted Data in Etcd
  - startTime: 4950
    title: Fixing Etcd Encryption Config (Adding Identity)
  - startTime: 5104
    title: API Server Becomes Stable
  - startTime: 5125
    title: Debugging Postgres Authentication Error
  - startTime: 5330
    title: Identifying Malicious Postgres Startup Command
  - startTime: 5355
    title: Fixing Postgres Startup Command
  - startTime: 5548
    title: Barco's Cluster Fixed
  - startTime: 5560
    title: Wrap Up & Explanations of Breaks
  - startTime: 5674
    title: Final Words & Thanks
duration: 5734
---

