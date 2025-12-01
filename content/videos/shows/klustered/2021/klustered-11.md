---
id: klustered-11
slug: klustered-11
title: 'Klustered #11'
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - This Video\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n04:00 - Introductions\n06:30 - Cluster by Kris Nova\n40:00 - Cluster by Thomas Stromberg\n\n\U0001F465 About the Guests\n\nThomas Stromberg\n\n  Amateur Bike Builder, Software Choreographer & Father. Bad Idea Propagator, Kubernetes Contributor.\n\n\n\U0001F426 https://twitter.com/thomrstrom\n\U0001F9E9 https://github.com/tstromberg\n\U0001F30F http://stromberg.org/t/\n\n\nKris Nova\n\n  professional grown-up business adult does important computer hacks | wealthy computer boopsperson pays cyberbills and loves capitalism | twitch http://nivenly.com/live\n\n\n\U0001F426 https://twitter.com/krisnova\n\U0001F9E9 https://github.com/kris-nova\n\U0001F30F https://nivenly.com\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-05-07T17:00:00.000Z
technologies: []
show: klustered
videoId: byfqy7h28x7wcs80mweqt6kb
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 240
    title: Introductions
  - startTime: 263
    title: Introduction & Welcome
  - startTime: 306
    title: Guest Introductions (Thomas & Chris)
  - startTime: 375
    title: 'Starting Challenge 1: Chris''s Cluster - Initial Look'
  - startTime: 390
    title: Cluster by Kris Nova
  - startTime: 510
    title: Initial Diagnosis & Forensic Tools (Using FLS)
  - startTime: 761
    title: App Deployment Fails - API Server Issue
  - startTime: 1010
    title: Identifying Malicious Static Pod Manifest
  - startTime: 1345
    title: Malicious Pod Manifest Keeps Returning
  - startTime: 1461
    title: Tracing Persistence to Systemd Service & LD_PRELOAD
  - startTime: 1621
    title: Fixing File System Access (LD_PRELOAD)
  - startTime: 1682
    title: Restoring the Correct Kubernetes API Server Manifest
  - startTime: 1971
    title: Cleaning Up Malicious Artifacts (Infect Namespace)
  - startTime: 2061
    title: Challenge 1 Fixed & Exploit Analysis
  - startTime: 2400
    title: Cluster by Thomas Stromberg
  - startTime: 2401
    title: 'Starting Challenge 2: Thomas''s Cluster - Initial Look'
  - startTime: 2657
    title: App Deployment Fails - ETCD Database Exceeded Error
  - startTime: 3044
    title: Investigating ETCD Connectivity Issues
  - startTime: 4300
    title: Identifying & Blocking the ETCD Attacker IP
  - startTime: 4501
    title: ETCD Flooding Exploit Revealed
  - startTime: 4538
    title: ETCD Cleanup & Validation (Increasing Size Quota)
  - startTime: 4601
    title: Challenge 2 Fixed & Wrap Up
duration: 4919
---

