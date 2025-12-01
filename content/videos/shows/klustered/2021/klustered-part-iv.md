---
id: klustered-part-iv
slug: klustered-part-iv
title: Klustered (Part IV)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://gitlab.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - This Video\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n00:50 - Introductions\n03:00 - Cluster 007 by Dan Pop and Matt Moore\n59:00 - Cluster 008 by Akos Veres\n\n\U0001F465 About the Guests\n\nLee Briggs\n\n  Lee Briggs is a Staff Software Engineer at Pulumi. With almost 10 years of experience designing, building and maintaining distributed and complex systems, he wears the scars of many deployment tools. When he’s not trying to fit monolithic applications into containers, he playing and watching Soccer and walks with his dog, Cindy.\n\n\n\U0001F426 https://twitter.com/briggsl\n\U0001F9E9 https://github.com/jaxxstorm\n\U0001F30F https://www.leebriggs.co.uk/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://gitlab.com/rawkode/klustered"
publishedAt: 2021-03-12T17:00:00.000Z
technologies: []
show: klustered
videoId: pa7r65u76f3gfxp1ygtjgxu2
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 50
    title: Introductions
  - startTime: 53
    title: Intro and Guest
  - startTime: 171
    title: Initial Assessment (Cluster 1)
  - startTime: 180
    title: Cluster 007 by Dan Pop and Matt Moore
  - startTime: 223
    title: Debugging Cluster 1 API Access
  - startTime: 438
    title: Debugging Cluster 1 API Server Manifest
  - startTime: 665
    title: Fixing Cluster 1 API Server Manifest Filename/Port
  - startTime: 790
    title: Debugging Cluster 1 Kubelet Binary and Permissions
  - startTime: 945
    title: Fixing Cluster 1 Kubelet Binary and Permissions
  - startTime: 1146
    title: Debugging Cluster 1 API Server Connectivity (429 Error)
  - startTime: 2020
    title: Debugging Cluster 1 Admission Controller (Validation Webhook)
  - startTime: 2200
    title: Fixing Cluster 1 Validation Webhook
  - startTime: 2303
    title: Checking Cluster 1 Node Status
  - startTime: 2365
    title: Debugging Cluster 1 Worker Node & Pod Scheduling
  - startTime: 2800
    title: Debugging Cluster 1 Allocatable CPU (Red Herring)
  - startTime: 3311
    title: Debugging Cluster 1 Mutating Webhook
  - startTime: 3432
    title: Verifying Cluster 1 Fixes
  - startTime: 3496
    title: Initial Assessment (Cluster 2)
  - startTime: 3540
    title: Cluster 008 by Akos Veres
  - startTime: 3577
    title: Debugging Cluster 2 API Access and Components
  - startTime: 3601
    title: Debugging Cluster 2 Kubelet RPC Errors
  - startTime: 3688
    title: Checking Cluster 2 API Server Health (429)
  - startTime: 4227
    title: Debugging Cluster 2 etcd Connectivity (Red Herring)
  - startTime: 4635
    title: Debugging Cluster 2 Containerd (Exited)
  - startTime: 4709
    title: Fixing Cluster 2 Containerd
  - startTime: 4762
    title: Debugging Cluster 2 Pod Scheduling
  - startTime: 4939
    title: Debugging Cluster 2 CNI Init Container Error
  - startTime: 5457
    title: Identifying Cluster 2 CNI Image Pull Policy Issue
  - startTime: 5476
    title: Fixing Cluster 2 CNI Image Pull Policy
  - startTime: 5507
    title: Verifying Cluster 2 Fixes
  - startTime: 5593
    title: Conclusion
duration: 5695
---

