---
id: klustered-part-vii
slug: klustered-part-vii
title: Klustered (Part VII)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - This Video\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n03:00 - Introductions\n08:00 - Kluster 014\n58:00 - Kluster 015\n\n\U0001F465 About the Guests\n\nGuinevere Saenger\n\n  She/her. All things Kubernetes. Ada c6. Dev-lifecycle @github.\n\n\n\U0001F426 https://twitter.com/guincodes\n\U0001F9E9 https://github.com/guineveresaenger\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/rawkode/klustered"
publishedAt: 2021-04-02T17:00:00.000Z
technologies: []
show: klustered
videoId: dxxgafdnayd30spjingobsv8
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 180
    title: Introductions
  - startTime: 196
    title: 'Introduction, Show Premise & Housekeeping'
  - startTime: 280
    title: 'Introducing Guest: Guinevere Zinger'
  - startTime: 476
    title: Starting Debugging on Cluster 14 (Broken by Phil)
  - startTime: 480
    title: Kluster 014
  - startTime: 618
    title: 'Initial Cluster 14 State: Missing App Pod in Default Namespace'
  - startTime: 657
    title: 'Checking Pods in All Namespaces (Cilium, Kiverno, etc.)'
  - startTime: 762
    title: 'Investigating Stuck Pod: Cilium CNI Plugin Error'
  - startTime: 3480
    title: Kluster 015
  - startTime: 3735
    title: 'Failed App Deployment: ETCD Request Too Large Error'
  - startTime: 3977
    title: Fixing ETCD Max Request Bytes Configuration
  - startTime: 4146
    title: Pod Stuck in Terminating State
  - startTime: 4219
    title: Node Not Ready / Kubelet Issues Identified
  - startTime: 4385
    title: Investigating Kubelet Systemd Service File and Logs
  - startTime: 4620
    title: Finding Kubelet Feature Gate Error (CPUCFSQuotaPeriod)
  - startTime: 4645
    title: Fixing Kubelet Config Error
  - startTime: 4721
    title: 'Nodes Ready, Pods Stuck in Pending (Scheduler Issue)'
  - startTime: 4740
    title: Redeploying App and Discovering Deployment Failures
  - startTime: 4839
    title: Confirming Pods Have No Assigned Node
  - startTime: 4877
    title: 'Finding Admission Controller Errors (Mutating Webhooks, PSP)'
  - startTime: 5086
    title: Deleting Kiverno Mutating Webhooks (Distraction)
  - startTime: 5249
    title: 'Hint from Guy: Revisit Scheduler Configuration'
  - startTime: 5287
    title: Identifying Pod Security Policy Errors
  - startTime: 5400
    title: Deleting Suspicious Pod Security Policy
  - startTime: 5521
    title: 'Pod Security Policy Still Blocking: Checking API Server Config'
  - startTime: 5643
    title: Discovering Custom Scheduler Name Configuration
  - startTime: 5663
    title: Fixing Scheduler Configuration
  - startTime: 5730
    title: 'Cluster 12: Pods Now Scheduling & Starting (Scheduler Problem Solved)'
  - startTime: 5886
    title: Disabling Pod Security Policy Admission Controller in API Server
  - startTime: 6069
    title: App Running But Cannot Connect to Database (Connection Refused)
  - startTime: 6098
    title: 'Cluster 14: Pods Start Running (Initial Problem Solved)'
  - startTime: 6186
    title: App Logs Show DNS Lookup Failure
  - startTime: 6195
    title: Checking CoreDNS Pods and Logs
  - startTime: 6521
    title: Noticing Pods/Services on Different IP Ranges
  - startTime: 6880
    title: Checking Cilium Config Map (Pod CIDR vs Host Network)
  - startTime: 7087
    title: Starting Debugging on Cluster 12 (Broken by Guy)
  - startTime: 7117
    title: 'Discovering `hostNetwork: true` on App Pod (Minor Issue/Red Herring)'
  - startTime: 7140
    title: 'Initial Cluster 12 State: App & Postgres Pods Running, Seeing Unknown Pods'
  - startTime: 7620
    title: 'Hint from Guy: Check CoreDNS Config Map for Small Typo'
  - startTime: 7896
    title: Identifying the CoreDNS Config Map Typo (`clouster.local`)
  - startTime: 8284
    title: Fixing CoreDNS Config Map Typo
  - startTime: 8323
    title: 'Cluster 12: App Works (DNS Problem Solved)'
  - startTime: 8341
    title: Conclusion and Thanks
duration: 8440
---

