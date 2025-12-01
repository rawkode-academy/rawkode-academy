---
id: klustered-part-v
slug: klustered-part-v
title: Klustered (Part V)
description: ".Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://gitlab.com/rawkode/klustere.\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - This Video\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n\n\U0001F465 About the Guests\n\nJason DeTiberus\n\n  Senior Staff Software Engineer at Equinix Metal\n\n\n\U0001F426 https://twitter.com/detiber\n\U0001F9E9 https://github.com/detiber\n\U0001F30F https://twitter.com/detiber\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://gitlab.com/rawkode/klustered"
publishedAt: 2021-03-19T17:00:00.000Z
technologies: []
show: klustered
videoId: zun7qn3xym7pzttsckp91ame
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 198
    title: Introduction to Klustered and Guest Jason DeTibbers
  - startTime: 310
    title: Introducing Cluster 9 Breaker (Thomas Stromberg) & Challenge Level
  - startTime: 359
    title: Accessing Cluster 9 via Teleport
  - startTime: 425
    title: 'Initial Check: kubectl get nodes Fails'
  - startTime: 456
    title: 'Debugging Control Plane Processes (ps, ctr)'
  - startTime: 564
    title: Suspicious Process Found ("whale true")
  - startTime: 589
    title: Killing Suspicious Process
  - startTime: 623
    title: Checking Kubelet Logs (API Server Crash Backoff)
  - startTime: 678
    title: Checking API Server Logs (etcd Connection Issues)
  - startTime: 740
    title: Investigating etcd Port Status (Listening?)
  - startTime: 770
    title: Checking etcd Logs (No Obvious Failures)
  - startTime: 885
    title: Forcing API Server Restart (Touching Static Manifest)
  - startTime: 924
    title: 'Hint from Breaker: etcd Listening But Not Answering?'
  - startTime: 944
    title: Attempting etcdctl Install (DNS Issue Discovery)
  - startTime: 985
    title: Fixing Host DNS Resolution (/etc/resolv.conf)
  - startTime: 1035
    title: Verifying Host DNS (Ping Google)
  - startTime: 1060
    title: Querying etcd with etcdctl (Success - Binary Data)
  - startTime: 1131
    title: Forcing Control Plane Restarts (Touching Static Manifests Again)
  - startTime: 1171
    title: API Server Back Online (kubectl get nodes Success)
  - startTime: 1216
    title: 'Checking System Pods (CoreDNS, CCM Unhealthy/Pending)'
  - startTime: 1250
    title: Troubleshooting CoreDNS (Logs Unhelpful)
  - startTime: 1260
    title: Explanation of Static Pod Restarts via Touch
  - startTime: 1310
    title: Restarting Cloud Controller Manager Deployment
  - startTime: 1488
    title: Restarting CoreDNS Deployment
  - startTime: 1610
    title: CoreDNS Pod Running but Not Ready (Probes Failing)
  - startTime: 1640
    title: Inspecting CoreDNS Manifest (Probes Config)
  - startTime: 1805
    title: Inspecting CoreDNS DNS Policy (Default)
  - startTime: 1964
    title: Checking CoreDNS ConfigMap (Corefile)
  - startTime: 2101
    title: Identifying Potential ConfigMap Modification ("lame duck")
  - startTime: 2158
    title: Teleport Session Interruption (Resource Exhaustion?)
  - startTime: 2327
    title: SSH to Cluster 9 Fails
  - startTime: 2389
    title: Moving to Cluster 10
  - startTime: 2400
    title: Initial Access Issues on Cluster 10 (Teleport Hangs)
  - startTime: 2455
    title: Direct SSH to Cluster 10 Control Plane
  - startTime: 2470
    title: 'Cluster 10: API Server Down, Kubelet Running'
  - startTime: 2505
    title: 'Cluster 10: Static Manifest Backups Found (~ Files)'
  - startTime: 2561
    title: Returning to Cluster 9 (Teleport Restored)
  - startTime: 2595
    title: 'Cluster 9 Continued: API Server Down Again, Checking System Load'
  - startTime: 2691
    title: 'Checking All Namespaces: Evicted Pods (Honk, Rawkode)'
  - startTime: 2751
    title: 'Checking Pod Eviction Reasons (WordPress Volume, Honk iNodes)'
  - startTime: 2870
    title: Identifying iNode Exhaustion Source (/tmp Directory Size)
  - startTime: 3095
    title: Confirming /tmp Issue (ls Hangs)
  - startTime: 3300
    title: Deleting Excessive Files in /tmp (Using find)
  - startTime: 3470
    title: DNS Issue Returns Again (/etc/resolv.conf Modified)
  - startTime: 3538
    title: Identifying and Removing the DNS Cron Job
  - startTime: 3710
    title: Fixing CoreDNS ConfigMap
  - startTime: 3747
    title: Restarting CoreDNS to Pick Up New Config
  - startTime: 3780
    title: 'CoreDNS Pod Creation Failure (DNS, Image Pull Again)'
  - startTime: 3880
    title: Host DNS Reverted Again (Despite Cron Removal)
  - startTime: 3950
    title: Deleting the Problematic Cron File
  - startTime: 4000
    title: Re-fixing Host DNS Resolution
  - startTime: 4065
    title: CoreDNS Image Pull Backoff (Still Failing)
  - startTime: 4079
    title: Identifying CoreDNS ImagePullPolicy Issue (IfNotPresent)
  - startTime: 4119
    title: 'CoreDNS Healthy, Control Plane Stabilizes'
  - startTime: 4140
    title: Changing CoreDNS ImagePullPolicy to Always
  - startTime: 4145
    title: Troubleshooting Application Pods (Pending/Evicted)
  - startTime: 4206
    title: Confirming CoreDNS ConfigMap Modification (Health Check)
  - startTime: 4378
    title: Identifying Node Taints (Disk/Memory/Network Pressure)
  - startTime: 4550
    title: Removing Node Taints
  - startTime: 4600
    title: Pods Start Scheduling/Running Faster (Ceph Recovers)
  - startTime: 4640
    title: Debugging WordPress/MySQL Volume Attachment Issues
  - startTime: 4700
    title: Force Deleting Pod with Volume Problem
  - startTime: 4740
    title: Continued Volume Attachment Issues
  - startTime: 4897
    title: WordPress Pod Running but Stuck on Volume
  - startTime: 4908
    title: Deleting WordPress PVC (Acknowledging Potential Data Loss)
  - startTime: 4975
    title: WordPress Pod Recovers with New PVC
  - startTime: 5130
    title: Cluster 9 Appears Fixed
  - startTime: 5155
    title: Returning to Cluster 10
  - startTime: 5170
    title: Cluster 10 Access Issues Resume
  - startTime: 5278
    title: >-
      Investigating Cluster 10: API Server Down, Netstat Shows Port Not
      Listening
  - startTime: 5480
    title: Discovering `/etc/kubernetes/manifests` is a Symlink
  - startTime: 5504
    title: Viewing the Rickroll Manifest
  - startTime: 5510
    title: Identifying Empty etcd Manifest
  - startTime: 5544
    title: System Instability & Teleport/SSH Hangs (Recursive Mounts?)
  - startTime: 5590
    title: 'Access Restored, Symlink Target Identified (`/home/kube/manifests`)'
  - startTime: 5630
    title: System Hangs Again (Recursive Mounts Confirmed?)
  - startTime: 5700
    title: Using `mount` to Confirm Recursive Mounts
  - startTime: 5830
    title: 'Access Restored, Confirming Recursive Mounts'
  - startTime: 5890
    title: Attempting to Unmount Recursive Mounts (Fails - Busy)
  - startTime: 5935
    title: System Hangs Again
  - startTime: 6000
    title: 'Access Restored, Unmount Still Failing'
  - startTime: 6105
    title: Stopping Kubelet Before Unmounting
  - startTime: 6130
    title: Unmount Attempt After Stopping Kubelet (Still Busy)
  - startTime: 6205
    title: System Hangs Again
  - startTime: 6285
    title: Using LSOF (from another terminal) to Identify Busy Processes
  - startTime: 6339
    title: Identifying and Killing the Recursive Mount Process Script
  - startTime: 6370
    title: 'Unmount Attempt After Killing Script (Still Busy, Faster)'
  - startTime: 6440
    title: Identifying Remaining Busy Processes (Shells in Mount Path)
  - startTime: 6600
    title: Killing Remaining Suspicious Shell Processes
  - startTime: 6640
    title: Removing the Recursive Mount Symlink
  - startTime: 6680
    title: 'Static Manifest Directory is Gone, Need to Recreate'
  - startTime: 6718
    title: Locating Static Pod Path Configuration
  - startTime: 6785
    title: Recreating Control Plane Static Manifests (Using kubeadm phases)
  - startTime: 6892
    title: Lazy Unmounting Remaining Busy Paths (`umount -l`)
  - startTime: 6981
    title: Starting Kubelet
  - startTime: 7015
    title: 'Kubelet Logs Show Progress, API Server Pod Creating'
  - startTime: 7070
    title: Cluster 10 API Server Restores (kubectl get nodes Success)
  - startTime: 7110
    title: Final Pod Check on Cluster 10 (Healthy)
  - startTime: 7145
    title: Cluster 10 Resolved
  - startTime: 7170
    title: Conclusion & Thanks
duration: 7245
---

