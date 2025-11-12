---
id: 22-leigh-capili-vs-marcus-noble
slug: 22-leigh-capili-vs-marcus-noble
title: 22. Leigh Capili vs. Marcus Noble
description: "#Klustered Live #Kubernetes Debugging\n\n#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\"\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2022-04-08T17:00:00.000Z
technologies: []
show: klustered
videoId: peig5ghfiyldrd5pm4u9opzu
chapters:
  - startTime: 0
    title: <Untitled Chapter 1>
  - startTime: 92
    title: 'Introduction: Welcome & Cluster Day'
  - startTime: 122
    title: 'Sponsors: Teleport & Equinix Metal'
  - startTime: 160
    title: Equinix Metal
  - startTime: 202
    title: Competition Announcement
  - startTime: 211
    title: 'Guest Introductions: Lee Capili & Marcus Noble'
  - startTime: 229
    title: Introduction
  - startTime: 366
    title: 'Lee''s Challenge Begins: Access & Initial Setup'
  - startTime: 705
    title: Lee Investigates Cluster State & API Errors
  - startTime: 848
    title: 'Lee Debugs API Server Connection: NGINX Proxy?'
  - startTime: 989
    title: 'Lee Finds Kubeconfig Port Misconfiguration (localhost:443)'
  - startTime: 1128
    title: Lee Debugs Container Runtime & Kubelet State
  - startTime: 1328
    title: Lee Finds Kubelet Service Disabled
  - startTime: 1551
    title: Lee Fixes Kubelet Systemd Unit (Enable & Restart)
  - startTime: 1796
    title: 'Lee Debugs Kubelet Startup Error: Invalid Max Files'
  - startTime: 1830
    title: 'Lee Fixes Kubelet Config (`containerLogMaxFiles`, `maxPods`)'
  - startTime: 1893
    title: Kubelet Component Config
  - startTime: 1986
    title: Kubelet Starts & Core Pods Appear
  - startTime: 2147
    title: Lee Checks Application Deployment (Scaled to 0)
  - startTime: 2230
    title: 'Lee Attempts to Scale Deployment: Admission Webhook Error'
  - startTime: 2696
    title: Lee Fixes Webhook Issues (Deleting Configurations)
  - startTime: 2871
    title: 'Lee Debugs Deployment Scaling: Quota & Pod Security Policy Errors'
  - startTime: 3062
    title: Lee Fixes API Server Config (Disabling PSP Admission Controller)
  - startTime: 3185
    title: >-
      Lee's Time Ends & Marcus Explains His Breaks (Limit Ranges, Pause
      Container)
  - startTime: 3445
    title: Why Do the Static Pods Work
  - startTime: 3698
    title: Transition to Marcus's Challenge
  - startTime: 3708
    title: 'Marcus''s Challenge Begins: Access & Setup'
  - startTime: 3788
    title: Marcus Investigates Cluster State & RBAC Forbidden Errors
  - startTime: 4385
    title: Marcus Finds User Identity (`uwu-admin`) & Break Glass Hint
  - startTime: 4507
    title: Marcus Debugs Break Glass Cluster Role Binding Access
  - startTime: 4938
    title: Marcus Attempts `kubeadm certs renew admin.conf` (Attempt 1)
  - startTime: 5596
    title: Marcus Resets the Cluster (`kubeadm reset`)
  - startTime: 5695
    title: Cluster Redeployment & Untainting Node
  - startTime: 5993
    title: Lee Re-injects a Break (PSP Default Provider)
  - startTime: 6041
    title: Marcus Debugs Postgres Crash Loop (Deleted StatefulSet/Pod)
  - startTime: 6103
    title: 'Marcus Debugs Postgres: Waiting for PVC (etcd Issue)'
  - startTime: 6251
    title: Time Called & Lee Explains His Breaks
  - startTime: 6447
    title: Conclusion & Giveaway Winners
  - startTime: 6460
    title: T-Shirt Giveaway
duration: 6577
---

