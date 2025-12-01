---
id: klustered-teams-raft-and-rx-m
slug: klustered-teams-raft-and-rx-m
title: 'Klustered Teams: Raft & RX-M'
description: "#Klustered Teams\nKubernetes live debugging\n#KubernetesTutorial\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\"\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F465 About the Guests\n\nRaft\n\n  A new breed of digital consulting firm, that’s part full stack consultancy, part think tank and part band of creative folks. We’re problem solvers and innovators with a focus on Open Source. Our name is actually inspired from the , which revolutionized solving consensus problems by being more reliable and easier to understand. It is also the algorithm implemented by etcd (brain of the Kubernetes). We took on this name because we share a similar goal: replace any overly complex and outdated system with a new, efficient, and secure one that just works.\n\n\n\U0001F426 https://twitter.com/raft_tech\n\U0001F9E9 https://github.com/raft-tech\n\U0001F30F https://goraft.tech/\n\n\nRX-M\n\n  Cloud-Native technology training and consulting firm RX-M trains and consults with a quarter of Fortune 100 companies. As a charter member of the Cloud Native Computing Foundation and in the founding class of Kubernetes Certified Service Providers and Kubernetes Training Providers, RX-M offers industry-leading training, advisory, consulting, and staffing services. RX-M provides a catalog of standard and custom courses for technologies and business practices essential to digital transformation. Our training includes cloud and microservice-based application design to Scrum, DevOps, and SRE practices. The RX-M team embodies thought leaders who are published authors, patent holders, and prominent open source contributors–all focused on customer success. We champion an unbiased, market-neutral approach.\n\n\n\U0001F426 https://twitter.com/rxmllc\n\U0001F9E9 https://github.com/rx-m\n\U0001F30F https://rx-m.com/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-12-10T17:00:00.000Z
technologies: []
show: klustered
videoId: x19zjl7plya11i3eqjkt2zra
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 81
    title: Welcome and Show Intro
  - startTime: 110
    title: 'Sponsors: Teleport & Equinix Metal'
  - startTime: 157
    title: 'Introducing Team 1: RXM'
  - startTime: 216
    title: Technical Streaming Issue
  - startTime: 360
    title: Team 1 Re-introduction (RXM)
  - startTime: 404
    title: Starting Debugging Cluster 1 (Raft Tech)
  - startTime: 445
    title: Cluster Access & KubeConfig Issues
  - startTime: 615
    title: Investigating API Server Connection
  - startTime: 733
    title: Checking API Server Manifest Flags
  - startTime: 901
    title: Debugging Editor Permissions (Vi)
  - startTime: 965
    title: Fixing Editor Permissions
  - startTime: 1062
    title: Debugging ETCD Connection Failure
  - startTime: 1176
    title: Investigating ETCD Manifest & Certs
  - startTime: 1257
    title: Checking ETCD Logs
  - startTime: 1504
    title: Fixing ETCD Cert Path Typo
  - startTime: 1761
    title: Checking API Server Logs (Again)
  - startTime: 1834
    title: Locating Namespace Typo in API Server Config
  - startTime: 1927
    title: Fixing API Server Namespace Typo
  - startTime: 1958
    title: API Server & ETCD Pods Running
  - startTime: 1978
    title: Checking Application Pods (Scaled to Zero)
  - startTime: 2277
    title: Scaling Up Application Deployment
  - startTime: 2308
    title: Debugging Pending Pod (Node Taint)
  - startTime: 2398
    title: Untainting Worker Nodes
  - startTime: 2445
    title: Fixing Application Image Name Typo
  - startTime: 2644
    title: Debugging Readiness Probe / Pod Ready
  - startTime: 2680
    title: Checking Application Status (Database Failure)
  - startTime: 2704
    title: Debugging Missing Postgres Database
  - startTime: 2759
    title: Applying Postgres Manifest
  - startTime: 2871
    title: Cluster 1 Fixed! (RXM Success)
  - startTime: 2885
    title: RXM Team Debrief
  - startTime: 2971
    title: Transition to Team 2
  - startTime: 2978
    title: Sponsor Recap
  - startTime: 3002
    title: 'Introducing Team 2: Raft'
  - startTime: 3064
    title: Debugging Cluster 2 (RXM)
  - startTime: 3135
    title: Initial Cluster Check & App Status (V1 Working)
  - startTime: 3177
    title: Attempting Application Upgrade to V2
  - startTime: 3301
    title: Investigating Pod Errors (Old Logs)
  - startTime: 3340
    title: 'Checking Deployment Status (V2 Image Set, ReplicaSet Failure)'
  - startTime: 3386
    title: Debugging ReplicaSet Creation Failure (RBAC User Forbidden)
  - startTime: 3439
    title: Investigating RBAC Permissions
  - startTime: 3627
    title: Checking Cluster Role Bindings
  - startTime: 3829
    title: Investigating ReplicaSet Controller Cluster Role
  - startTime: 3893
    title: Fixing Cluster Role Permissions (Add 'create' verb)
  - startTime: 3990
    title: Forcing Deployment Rollout (ReplicaSet Delete)
  - startTime: 4022
    title: 'New Error: Resource Quota Exceeded'
  - startTime: 4120
    title: Locating and Deleting Resource Quota
  - startTime: 4208
    title: Forcing Rollout Again (ReplicaSet Delete)
  - startTime: 4221
    title: Pod Stuck in Pending (No Scheduling Event)
  - startTime: 4284
    title: Checking Node Status
  - startTime: 4389
    title: Identifying Scheduler Issue
  - startTime: 4415
    title: Implementing NodeName Hack (Bypass Scheduler)
  - startTime: 4454
    title: Editing Deployment to Add NodeName
  - startTime: 4559
    title: Checking Application Status (V2 Working via Hack)
  - startTime: 4593
    title: Discussing the Scheduler Hack
  - startTime: 4631
    title: Raft Team Debrief
  - startTime: 4738
    title: Outro and Thanks
duration: 4833
---

