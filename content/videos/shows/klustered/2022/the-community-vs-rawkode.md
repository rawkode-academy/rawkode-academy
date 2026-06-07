---
id: ydqpwfanic1vdp76g6xaq23s
slug: the-community-vs-rawkode
title: The Community Vs. Rawkode
description: >-
  Community volunteers each get ten minutes to debug two broken Kubernetes
  clusters live. Cluster one hides a renamed etcd static pod manifest; cluster
  two has a rogue process scaling a deployment to zero via a malicious kubectl
  auth helper.
whatYouWillLearn:
  - "Diagnose a Kubernetes API server outage by auditing control plane components and kubelet/static pod manifests."
  - "Upgrade the broken clustered application from v1 to v2 in namespace while recovering failing controllers and services."
  - "Identify a hostile kubeauth helper by checking at jobs, process tables, and BCC tooling traces."
publishedAt: 2022-06-03T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - etcd
  - containerd
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 86
    title: Introduction and Episode Concept
  - startTime: 188
    title: Background on the Clustered Series
  - startTime: 227
    title: 'Sponsor Shoutout: Teleport'
  - startTime: 303
    title: 'Sponsor Shoutout: Equinix Metal'
  - startTime: 335
    title: Introducing the Audience Participation Buzzer
  - startTime: 356
    title: 'First Contestant: Benjamin Joins'
  - startTime: 420
    title: Getting Benjamin Access to Cluster 1
  - startTime: 533
    title: Debugging Cluster 1 Begins (API Server Down)
  - startTime: 615
    title: Investigating Logs and Manifests (etcd Issue)
  - startTime: 720
    title: Offering Hints and Support
  - startTime: 789
    title: Examining Static Manifests Directory
  - startTime: 871
    title: Looking at API Server Logs (Connection Refused)
  - startTime: 925
    title: Checking Kubelet Status and Logs
  - startTime: 1051
    title: Benjamin Hands Over
  - startTime: 1104
    title: 'Second Contestant: Bogdan Joins'
  - startTime: 1180
    title: Getting Bogdan Access to Cluster 1
  - startTime: 1376
    title: Debugging Cluster 1 Continues (Following Benjamin)
  - startTime: 1418
    title: Manifest Timestamps (Red Herring)
  - startTime: 1511
    title: Kubelet and Static Pods Investigation
  - startTime: 1612
    title: Restarting Kubelet and Tailoring Logs
  - startTime: 1696
    title: Controller Manager Issues Appear
  - startTime: 1832
    title: Cluster 1 API Server Becomes Responsive
  - startTime: 1857
    title: Attempting Application Upgrade
  - startTime: 1958
    title: Controller Manager Probe Failure
  - startTime: 1995
    title: Modifying Controller Manager Manifest
  - startTime: 2096
    title: 'Controller Manager Restarts, App Still Stalled'
  - startTime: 2128
    title: Success! Application Upgraded on Cluster 1
  - startTime: 2167
    title: Post-Mortem Cluster 1 (Rawkode Explains Intended Breaks)
  - startTime: 2281
    title: 'Third Contestant: FHKE Joins'
  - startTime: 2336
    title: Getting FHKE Access to Cluster 2 (Starting Fresh)
  - startTime: 2534
    title: Debugging Cluster 2 Begins (App Scaled to Zero)
  - startTime: 2564
    title: Checking Deployment Events
  - startTime: 2661
    title: 'Searching for the Rogue Scaling Process (Cron, Jobs, Systemd)'
  - startTime: 2788
    title: Examining Running Processes (ps aux)
  - startTime: 2936
    title: Considering Container Processes (nerdctl)
  - startTime: 3074
    title: FHKE Hands Over
  - startTime: 3118
    title: 'Fourth Contestant: Vladimir Joins'
  - startTime: 3203
    title: Getting Vladimir Access to Cluster 2
  - startTime: 3283
    title: Debugging Cluster 2 Continues (Following FHKE)
  - startTime: 3315
    title: Rogue Process Scales App Down Again
  - startTime: 3414
    title: Re-examining Images and Processes
  - startTime: 3447
    title: Vladimir Hands Over (Due to Family Interruption)
  - startTime: 3469
    title: 'Fifth Contestant: Alistair Joins'
  - startTime: 3521
    title: Getting Alistair Access to Cluster 2
  - startTime: 3559
    title: Kubeadl Conference Mention
  - startTime: 3621
    title: Debugging Cluster 2 Continues (Following Vladimir)
  - startTime: 3656
    title: Checking Images and Processes Again
  - startTime: 3720
    title: Keyboard Enthusiast Chat
  - startTime: 3780
    title: 'Chat Suggestions (Mutation Webhook, Process Table Focus)'
  - startTime: 3857
    title: Investigating Process Tree and Sleeping Processes
  - startTime: 4032
    title: 'Hint: Consider the `at` Daemon (`atq`)'
  - startTime: 4130
    title: Closer Look at `ps aux` Output
  - startTime: 4199
    title: Alistair Hands Over
  - startTime: 4232
    title: 'Sixth Contestant: Seth Joins'
  - startTime: 4304
    title: Getting Seth Access to Cluster 2
  - startTime: 4401
    title: Debugging Cluster 2 Continues (Following Alistair)
  - startTime: 4414
    title: Investigating `atq` and `systemctl timers` Again
  - startTime: 4491
    title: Installing and Using `nerdctl` for Container Processes
  - startTime: 4621
    title: Examining Container Processes Again
  - startTime: 4797
    title: Seth Hands Over
  - startTime: 4871
    title: 'Seventh Contestant: Dan Joins (Faces Technical Issues)'
  - startTime: 5044
    title: Dan Hands Over (Technical Issues Persist)
  - startTime: 5056
    title: Last Call for Volunteers / Community Discussion
  - startTime: 5186
    title: 'Eighth Contestant: Bogdan Returns'
  - startTime: 5229
    title: Getting Bogdan Access to Cluster 2 (Again)
  - startTime: 5298
    title: 'Bogdan Asks for Hints (Hint: Host, at daemon)'
  - startTime: 5321
    title: Investigating `atq` Again (Scheduled Jobs Reappear)
  - startTime: 5462
    title: 'Rawkode Hints: How kubectl Authenticates'
  - startTime: 5512
    title: Identifying the Malicious Auth Helper (`kubeauth-off-metal`)
  - startTime: 5569
    title: Revealing the Malicious Script Behind the Auth Helper
  - startTime: 5657
    title: Explanation of the Cluster 2 Break and the Proper Fix (Trusted KubeConfig)
  - startTime: 5730
    title: 'Debugging Tools Demonstration (execsnoop, open snoop)'
  - startTime: 5904
    title: 'Conclusion, Thank You, and Upcoming Schedule'
duration: 5996
resources:
  - title: Teleport
    type: url
    url: 'https://goteleport.com/'
    category: other
  - title: Equinix Metal
    type: url
    url: 'https://deploy.equinix.com/'
    category: other
  - title: Klustered playlist
    type: url
    category: other
  - title: KubeHuddle
    type: url
    url: 'https://kubehuddle.com/'
    category: other
---
