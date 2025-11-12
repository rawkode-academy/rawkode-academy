---
id: klustered-teams-ambassador-labs-and-fairwinds
slug: klustered-teams-ambassador-labs-and-fairwinds
title: Klustered Teams - Ambassador Labs & Fairwinds
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\"\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-03-04T17:00:00.000Z
technologies: []
show: klustered
videoId: vt7ini6wdrms1hbc8z9rk44u
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 104
    title: Introduction & Sponsors
  - startTime: 166
    title: Introducing Team Ambassador Labs
  - startTime: 174
    title: Team Ambassador Labs Introductions
  - startTime: 250
    title: Start of Team 1 Challenge (Ambassador Labs vs Fairwinds' Break)
  - startTime: 293
    title: 'Initial Cluster Diagnosis (`get nodes`, `get pods`)'
  - startTime: 374
    title: Identifying OOM Killed and Memory Limits
  - startTime: 421
    title: Fixing Memory Limits
  - startTime: 503
    title: Testing Application Connectivity (Initial Failure)
  - startTime: 570
    title: Discovering the "Gotcha" Message & First Hint
  - startTime: 611
    title: 'Investigating Networking (Ingress, Network Policies)'
  - startTime: 698
    title: Checking Application Image
  - startTime: 756
    title: Attempting to Deploy V2
  - startTime: 796
    title: V2 Still Shows "Gotcha"
  - startTime: 966
    title: Checking Service Endpoints (Matches Pod IP)
  - startTime: 1111
    title: Discussion on Image Source & Lower Level Issues
  - startTime: 1188
    title: ASCII Art Message Found
  - startTime: 1217
    title: 'Hint 1: System Namespaces'
  - startTime: 1272
    title: 'Exploring System Namespaces (`kube-system`, `kube-public`)'
  - startTime: 1686
    title: Rogue Postgres Discovered in `kube-public`
  - startTime: 1843
    title: Understanding the Postgres Setup & Data Injection Idea
  - startTime: 2010
    title: Investigating CoreDNS Configuration
  - startTime: 2105
    title: CoreDNS Rewrite Rule Found (DNS Hijack)
  - startTime: 2117
    title: Fixing CoreDNS Configuration
  - startTime: 2255
    title: 'Restarting Application Pod & Testing (New Error: DB Connection)'
  - startTime: 2322
    title: 'Hint from Chat: Default Postgres Service has No Endpoints'
  - startTime: 2353
    title: Identifying Missing Labels on Default Postgres Pod
  - startTime: 2435
    title: Investigating Default Postgres StatefulSet
  - startTime: 2734
    title: Finding Replicas Set to Zero
  - startTime: 2797
    title: Confirming Team 1 Success (V2 Running)
  - startTime: 2807
    title: Team Ambassador Labs Debrief
  - startTime: 2830
    title: Transition to Team Fairwinds
  - startTime: 2910
    title: Team Fairwinds Introductions
  - startTime: 3018
    title: Start of Team 2 Challenge (Fairwinds vs Ambassador Labs' Break)
  - startTime: 3073
    title: Initial KubeConfig Issues (Typo in "keys")
  - startTime: 3203
    title: KubeConfig Error Persists
  - startTime: 3531
    title: Suspecting the Kubectl Binary/Command
  - startTime: 3695
    title: 'Hint File Review ("Carta", "Tainted Love")'
  - startTime: 3730
    title: Investigating KubeConfig Keys & Typos Again
  - startTime: 4108
    title: Bypassing the Hijacked Kubectl (`/usr/bin/kubectl`)
  - startTime: 4191
    title: Finding the Kubectl Function in `.bashrc`
  - startTime: 4221
    title: Unsetting the Kubectl Function
  - startTime: 4230
    title: Fixing KubeConfig Key Swap & Testing Kubectl
  - startTime: 4250
    title: 'Diagnosis: Pending Pod and Node Taints'
  - startTime: 4333
    title: Fixing Node Taints
  - startTime: 4384
    title: Testing V1 Application (Still Not Working)
  - startTime: 4470
    title: 'Hint 3: Policy Agent'
  - startTime: 4487
    title: Discovering the Network Policy
  - startTime: 4527
    title: Deleting the Network Policy
  - startTime: 4542
    title: Testing V1 Application (Working)
  - startTime: 4549
    title: Attempting to Deploy V2 Again
  - startTime: 4597
    title: Network Policy Reappears - Investigating Recreators
  - startTime: 4694
    title: Checking System Cron Job
  - startTime: 4720
    title: Finding and Removing the Cron Job Entries
  - startTime: 4743
    title: Editing Deployment to V2 Again
  - startTime: 4781
    title: Confirming Team 2 Success (V2 Running)
  - startTime: 4838
    title: Team Fairwinds Debrief
  - startTime: 4879
    title: Conclusion & Thanks
duration: 4990
---

