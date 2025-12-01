---
id: klustered-part-iii
slug: klustered-part-iii
title: Klustered (Part III)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nKluster 003 was broken by Justin Garrison (https://twitter.com/rothgar of Amazon Web Services\nKlister 006 was broken by Ian Coldwater (https://twitter.com/IanColdwater).\nThe post-mortems are available at https://gitlab.com/rawkode/klustered\n\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - This Video\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:50 - Introductions\n03:40 - Kluster 003 by Justin Garrison\n48:00 - Kluster 006 by SIG Honk (Ian Coldwater, Duffie Cooley, Rory McCune, Brad Geesaman)\n\n\U0001F465 About the Guests\n\nMichael Hausenblas\n\n  My name is Michael Hausenblas, I'm an Open Source Product Developer Advocate at AWS and serve as an Cloud Native Ambassador at CNCF, focusing on observability (OpenTelemetry) as well as service meshes (Service Mesh Interface). \n\n\n\U0001F426 https://twitter.com/mhausenblas\n\U0001F9E9 https://github.com/mhausenblas\n\U0001F30F https://mhausenblas.info/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://gitlab.com/rawkode/klustered"
publishedAt: 2021-03-05T17:00:00.000Z
technologies: []
show: klustered
videoId: jder260f0z8zix9nh7u198mx
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 56
    title: Introduction and Show Premise
  - startTime: 220
    title: Kluster 003 by Justin Garrison
  - startTime: 223
    title: Introducing Cluster 1 (Cluster Three by Justin Garrison)
  - startTime: 260
    title: 'Initial Diagnosis: kubectl Fails (Certificate Error)'
  - startTime: 334
    title: SSH Access via Teleport & Finding the MOTD Hint
  - startTime: 703
    title: Fixing Cluster 1 Expired Certificates
  - startTime: 935
    title: Troubleshooting API Server Restart (Static Pod Issue)
  - startTime: 1287
    title: Applying Certificate Fixes to All Control Planes
  - startTime: 1444
    title: Cluster 1 API Server Access Restored
  - startTime: 1507
    title: Troubleshooting Cluster 1 Load Balancer (MetalLB/CCM)
  - startTime: 1864
    title: Identifying and Attempting to Fix CCM Authentication Secret
  - startTime: 2481
    title: Troubleshooting Cluster 1 DNS (dig & resolv.conf)
  - startTime: 2848
    title: Concluding Cluster 1 (Partially Unsolved)
  - startTime: 2880
    title: >-
      Kluster 006 by SIG Honk (Ian Coldwater, Duffie Cooley, Rory McCune, Brad
      Geesaman)
  - startTime: 2914
    title: Introducing Cluster 2 (Cluster Two by Team SIGHONK)
  - startTime: 2932
    title: 'Initial Diagnosis: kubectl Works, SSH Behaves Strangely'
  - startTime: 3053
    title: Investigating Containerized SSH Session
  - startTime: 3273
    title: Accessing Host Filesystem via SSH Forwarding
  - startTime: 3449
    title: Fixing Malicious SSHD Binary on Host
  - startTime: 3557
    title: Troubleshooting WordPress Deployment (No Pods Created)
  - startTime: 3609
    title: Identifying Permissions Issue (Cannot Delete ReplicaSet)
  - startTime: 3784
    title: Identifying Malicious API Server Image & Admission Plugins
  - startTime: 3956
    title: Fixing API Server Image on Control Planes
  - startTime: 4983
    title: Troubleshooting Controller Manager (No Pods Created)
  - startTime: 5298
    title: Fixing Controller Manager Flags (Enabling ReplicaSet Controller)
  - startTime: 5542
    title: Verifying WordPress Deployment (Pods Running)
  - startTime: 5571
    title: WordPress Service Accessible
  - startTime: 5639
    title: Final Wrap-up
duration: 5765
---

