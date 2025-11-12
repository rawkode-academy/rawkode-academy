---
id: klustered-14
slug: klustered-14
title: 'Klustered #14'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock. #KubernetesTutorial\n#KubernetesTutorial #LiveDebugging\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - This Video\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:55 - Introductions\n03:55 - Cluster 31 by Arian van Putten (@ProgrammerDude)\n53:00 - Cluster 32 by Sid Palas (@sidpalas)\n\n\U0001F465 About the Guests\n\nSid Palas\n\n  \U0001F9D9‍♂️ DevOps / \U0001F5A5 Cloud Infrastructure / \U0001F3AC YouTube\n\n\n\U0001F426 https://twitter.com/sidpalas\n\U0001F9E9 https://github.com/sidpalas\n\U0001F30F https://devopsdirective.com\n\n\nArian van Putten\n\n  systemd+linux enthusiast. NixOS enthousiast / Backend at @wire / he/him\n\n\n\U0001F426 https://twitter.com/ProgrammerDude\n\U0001F9E9 https://github.com/arianvp\n\U0001F30F https://arianvp.me/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-06-11T17:00:00.000Z
technologies: []
show: klustered
videoId: x372c0fhltxzq4h7ll4mfqh1
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 55
    title: Introductions
  - startTime: 72
    title: Housekeeping & Call to Action
  - startTime: 98
    title: Guest Introductions
  - startTime: 232
    title: 'Challenge 1: Sid''s Cluster (Cluster 31)'
  - startTime: 235
    title: Cluster 31 by Arian van Putten (@ProgrammerDude)
  - startTime: 333
    title: 'Initial Cluster State: Pods Unhealthy'
  - startTime: 346
    title: Diagnosing Postgres Scheduling Issue
  - startTime: 424
    title: Examining Worker Node Status
  - startTime: 447
    title: 'Worker Node: Memory and Kubelet Config'
  - startTime: 701
    title: Attempting to Remove Node Taint
  - startTime: 821
    title: Taint Reappears
  - startTime: 890
    title: Discovering NGINX Pod Evictions
  - startTime: 934
    title: Deleting Rogue NGINX Deployment
  - startTime: 1000
    title: Taint Persistence & Webhook Check
  - startTime: 1431
    title: Kubelet Cgroup Driver Issue Identified
  - startTime: 1957
    title: Attempting to Fix Cgroup Driver Issue
  - startTime: 2356
    title: Checking Networking & Port Forward
  - startTime: 2420
    title: Restarting Cilium Pods
  - startTime: 2522
    title: Restarting Control Plane Kubelet
  - startTime: 2701
    title: Verifying Kubelet Fixes & Status
  - startTime: 2810
    title: Confirming Service and Networking
  - startTime: 2887
    title: Upgrading Clustered App to V2
  - startTime: 2928
    title: Verifying V2 Upgrade (Success!)
  - startTime: 2990
    title: Explanation of Cluster 1 Issues
  - startTime: 3180
    title: Cluster 32 by Sid Palas (@sidpalas)
  - startTime: 3185
    title: 'Transition to Challenge 2: Adrian''s Cluster'
  - startTime: 3205
    title: 'Initial Cluster State: Clustered Pod Missing'
  - startTime: 3232
    title: Diagnosing and Fixing Replica Count
  - startTime: 3305
    title: '"Not a Virus" Pods Appear & Replicate'
  - startTime: 3407
    title: Investigating Source of Replication
  - startTime: 3603
    title: Examining Rogue Pod Details & API Access
  - startTime: 3700
    title: Analyzing Rogue Namespaces by Age
  - startTime: 3932
    title: Re-examining Clustered Pod as Trigger
  - startTime: 4311
    title: Searching for Rogue Process on Nodes
  - startTime: 5164
    title: Accessing the Rogue Container
  - startTime: 5440
    title: Examining Rogue Container Files (README)
  - startTime: 5521
    title: Stopping the Rogue Container (Source of Replication)
  - startTime: 5544
    title: Cleaning Up Rogue Namespaces
  - startTime: 5656
    title: Accelerating Cleanup and Redeploying Workloads
  - startTime: 5930
    title: Adding Tolerations & Redeploying Clustered/Postgres
  - startTime: 6063
    title: Upgrading Clustered App to V2 (Success)
  - startTime: 6103
    title: Explanation of Cluster 2 Brokenness & Conclusion
duration: 6357
---

