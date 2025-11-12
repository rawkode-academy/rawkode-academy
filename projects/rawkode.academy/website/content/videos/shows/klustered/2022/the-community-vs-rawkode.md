---
id: the-community-vs-rawkode
slug: the-community-vs-rawkode
title: The Community Vs. Rawkode
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\". Learn more about Equinix Metal at https://rawkode.live/metal\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-06-03T17:00:00.000Z
technologies: []
show: klustered
videoId: ydqpwfanic1vdp76g6xaq23s
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
---

