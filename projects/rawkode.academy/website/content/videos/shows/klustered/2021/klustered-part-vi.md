---
id: klustered-part-vi
slug: klustered-part-vi
title: Klustered (Part VI)
description: "Klustered is a series of live streams in which myself and a guest join forces to fix \"broken\" Kubernetes clusters ... on the clock.\nThese clusters are broken by members of the Kubernetes community.\nThe post-mortems are available at https://github.com/rawkode/klustered\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - This Video\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewers Comments\n02:20 - Introductions\n04:50 - Cluster 011, Broken by @SaiyamPathak\n01:12:00 - Cluster 013, Broken by @thebsdbox and @dtiber\n\n\U0001F465 About the Guests\n\nDuffie Cooley\n\n  Duffie is a Staff Cloud Native Architect focused on helping enterprises find success with technologies like Kubernetes. Duffie has been working with all things virtualization and networking for 20 years and remembers most of it. He likes to present on topics ranging from How do I solve this problem with Kubernetes to What even is a CNI implementation and which one should I choose?. A student of perspective, Duffie is always interested in working through problems and design choices from more than one perspective.\n\n\n\U0001F426 https://twitter.com/mauilion\n\U0001F9E9 https://github.com/mauilion\n\U0001F30F https://mauilion.dev/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes\n\n\n\U0001F30F Show Links\nhttps://github.com/rawkode/klustered"
publishedAt: 2021-03-26T17:00:00.000Z
technologies: []
show: klustered
videoId: tpt5t0dgsrai5h4lzutozcvm
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 140
    title: Introductions
  - startTime: 146
    title: Introduction & Housekeeping
  - startTime: 215
    title: Welcoming Guest Duffy
  - startTime: 290
    title: 'Cluster 011, Broken by @SaiyamPathak'
  - startTime: 296
    title: Starting Cluster 11 Troubleshooting (Siam is the Breaker)
  - startTime: 355
    title: Initial Cluster State Assessment (Nodes & Pods)
  - startTime: 610
    title: Fixing crictl Access
  - startTime: 771
    title: Application Connectivity Test (Port Forward)
  - startTime: 893
    title: Investigating CoreDNS & Controller Manager Pods
  - startTime: 1026
    title: Analyzing CoreDNS Configuration Map
  - startTime: 1252
    title: Checking Database Service Endpoints
  - startTime: 1351
    title: 'Pod Creation Forbidden: Discovering Admission Control'
  - startTime: 1402
    title: Inspecting API Server Admission Control Config
  - startTime: 1481
    title: Removing ImagePolicyWebhook Admission Control Config
  - startTime: 1605
    title: Explaining Node Restriction Admission Controller
  - startTime: 1777
    title: Pod Creation Blocked by Validation Policy
  - startTime: 1840
    title: Identifying Caverno and ClusterPolicy CRDs
  - startTime: 2031
    title: Examining the 'disable-pod' ClusterPolicy
  - startTime: 2169
    title: Deleting the 'disable-pod' Policy
  - startTime: 2245
    title: 'Pods Still Pending: Suspecting Node Readiness/Scheduling'
  - startTime: 2324
    title: Diagnosing Unready Worker Nodes (Kubelet Status)
  - startTime: 2418
    title: Troubleshooting Worker Node 7694F (Kubelet Logs)
  - startTime: 2558
    title: Fixing Kubelet Config File Typo
  - startTime: 2658
    title: Restarting Kubelet on Worker Node
  - startTime: 3008
    title: Node Becomes Ready but Scheduling Disabled (Kubeadm Taint)
  - startTime: 3037
    title: Worker Node Now Ready and Schedulable
  - startTime: 3063
    title: 'Application Still Failing: Re-evaluating Connectivity'
  - startTime: 3785
    title: 'Test Pod Unschedulable: Investigating Scheduler'
  - startTime: 3960
    title: 'Test Pod Running: Database Pod Failing'
  - startTime: 4020
    title: Testing Network Connectivity from Inside a Pod
  - startTime: 4148
    title: Network Works from CoreDNS Pod
  - startTime: 4185
    title: Discovering and Deleting Deny NetworkPolicy
  - startTime: 4215
    title: Application Connectivity Restored
  - startTime: 4233
    title: Upgrading Application to v2
  - startTime: 4295
    title: Cluster 11 Fixed and Application Upgraded
  - startTime: 4320
    title: 'Cluster 013, Broken by @thebsdbox and @dtiber'
  - startTime: 4336
    title: Transition to Cluster 13
  - startTime: 4348
    title: Starting Cluster 13 Troubleshooting (Connection Refused)
  - startTime: 4453
    title: No Kubernetes Components Running (crictl Check)
  - startTime: 4512
    title: Missing Kubernetes Manifests
  - startTime: 4571
    title: Inspecting etcd Directory (Suspicious Files)
  - startTime: 4631
    title: Restoring etcd Manifest
  - startTime: 4710
    title: Restoring API Server Manifest
  - startTime: 4793
    title: 'etcd Failure: Discovering File Permission Issue'
  - startTime: 4913
    title: Identifying Immutable File Attribute on etcd DB
  - startTime: 5049
    title: Explaining Immutable File Attributes (chattr)
  - startTime: 5110
    title: Removing Immutable Attribute from etcd DB
  - startTime: 5218
    title: Restoring etcd Manifest Again (After chattr)
  - startTime: 5278
    title: 'API Server Failure: Out of Memory Error'
  - startTime: 5444
    title: System Memory Restricted
  - startTime: 5510
    title: Identifying Restricted Memory via vm.min_free_kbytes Sysctl
  - startTime: 6142
    title: Comparing Sysctl Value to Healthy Host
  - startTime: 6300
    title: Resetting vm.min_free_kbytes
  - startTime: 6355
    title: API Server Comes Online After Memory Fix
  - startTime: 6386
    title: Restoring Controller Manager and Scheduler Manifests
  - startTime: 6489
    title: 'Control Plane Healthy, Worker Nodes Unready'
  - startTime: 6640
    title: Troubleshooting Worker Node DR44B
  - startTime: 6812
    title: 'DR44B Kubelet Error: Containerd Connection Refused'
  - startTime: 6878
    title: Starting Containerd on DR44B
  - startTime: 6908
    title: DR44B Node Becomes Ready
  - startTime: 7026
    title: Troubleshooting Worker Node QPQH
  - startTime: 7084
    title: 'QPQH Kubelet Status: Killed (SIGKILL)'
  - startTime: 7237
    title: Identifying Kubelet MemoryMax Limit in Systemd Unit
  - startTime: 7268
    title: Removing Kubelet Memory Limit
  - startTime: 7310
    title: QPQH Node Becomes Ready
  - startTime: 7336
    title: 'DR44B Node Issues Return: Too Many Open Files'
  - startTime: 7354
    title: Investigating File Descriptor Limits on DR44B
  - startTime: 7656
    title: DR44B Node Becomes Ready Again (Intermittent?)
  - startTime: 7740
    title: Testing Application on Cluster 13
  - startTime: 7812
    title: Application v2 Deployed and Working
  - startTime: 7840
    title: 'Discussion: Intermittent Issue & Calling it Done'
  - startTime: 7913
    title: Wrap-up and Thanks
duration: 8015
---

