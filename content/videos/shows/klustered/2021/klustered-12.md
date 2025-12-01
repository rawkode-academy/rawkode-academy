---
id: klustered-12
slug: klustered-12
title: 'Klustered #12'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered #12 - This Video\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:35 - Introductions\n03:30 - Cluster by Jeffrey Sica / Jeefy\n44:00 - Cluster by Chris Carty\n1:08:00 - Cluster by David McKay / Rawkode\n\n\U0001F465 About the Guests\n\nJeffrey Sica\n\n  SWE @ Red Hat | Kubernetes & OSS Advocate | CNCF Ambassador | Containers, DevOps, CI/CD are my jam. DMs open. Honk.\n\n\n\U0001F426 https://twitter.com/jeefy\n\U0001F9E9 https://github.com/jeefy\n\U0001F30F jeefy.dev\n\n\nChris Carty\n\n  CKA, CKAD | Customer Engineer @googlecloud. Canada Public Sector| YAML Engineer |  Thoughts are my own\n\n\n\U0001F426 https://twitter.com/macintoshPrime\n\U0001F9E9 https://github.com/cartyc\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-05-08T17:00:00.000Z
technologies: []
show: klustered
videoId: eaev2s8b2r56vaeu61fr9qsr
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 35
    title: Introductions
  - startTime: 37
    title: 'Introduction, Housekeeping & Sponsor'
  - startTime: 92
    title: Guest Introductions
  - startTime: 210
    title: Cluster by Jeffrey Sica / Jeefy
  - startTime: 221
    title: Debugging Jiffy's Cluster Begins
  - startTime: 271
    title: Identifying Crashing Pods
  - startTime: 329
    title: Investigating Postgres Image Error
  - startTime: 678
    title: Searching for Admission Controllers
  - startTime: 837
    title: Node-Level Investigation Begins
  - startTime: 1706
    title: Requesting a Hint
  - startTime: 1961
    title: Jiffy Shares Cluster Backstory (Hint)
  - startTime: 2009
    title: Deploying a Test Pod (Nginx)
  - startTime: 2158
    title: Switching to Worker Node Debug
  - startTime: 2372
    title: Suspecting a Modified Kubelet
  - startTime: 2416
    title: Reinstalling Kubelet
  - startTime: 2511
    title: Jiffy Explains Kubelet Break
  - startTime: 2640
    title: Cluster by Chris Carty
  - startTime: 2670
    title: Debugging Chris's Cluster Begins
  - startTime: 2805
    title: 'Gatekeeper Policy: Required Label'
  - startTime: 3051
    title: 'Gatekeeper Policy: Allowed Images'
  - startTime: 3240
    title: Deployment Scaling Issues
  - startTime: 3377
    title: Finding Blocking Webhook on Namespace Deletion
  - startTime: 3543
    title: Unblocking Namespace Deletion
  - startTime: 3612
    title: CNI Failure (Cilium Issue)
  - startTime: 3638
    title: Restarting Cilium
  - startTime: 3915
    title: Network Policy Blocking Traffic
  - startTime: 4061
    title: Deleting Network Policy & Success
  - startTime: 4080
    title: Cluster by David McKay / Rawkode
  - startTime: 4101
    title: Chris's Cluster Fixed & Rawkode's Offer
  - startTime: 4141
    title: Debugging Rawkode's Cluster (Optional Session Begins)
  - startTime: 4245
    title: API Server Rejection & Checking Kubeconfig
  - startTime: 4561
    title: Using Curl to Test API Server
  - startTime: 4670
    title: Re-examining Kubeconfig
  - startTime: 4893
    title: Identifying Kubeconfig Typo
  - startTime: 5051
    title: Fixing Kubeconfig Typo
  - startTime: 5081
    title: Chaos Pod Breakdown (Due to Fixed Kubeconfig)
  - startTime: 5222
    title: Chris Departs
  - startTime: 5244
    title: Rawkode Explains Static Pod Bug
  - startTime: 5546
    title: Searching for Hidden Static Manifest
  - startTime: 5707
    title: Rawkode Explains File Hiding Techniques
  - startTime: 5850
    title: Conclusion & Wrap Up
duration: 5935
---

