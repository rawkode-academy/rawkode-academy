---
id: peig5ghfiyldrd5pm4u9opzu
slug: 22-leigh-capili-vs-marcus-noble
title: 22. Leigh Capili vs. Marcus Noble
description: >-
  Leigh Capili and Marcus Noble debug broken Kubernetes clusters: kubelet
  systemd units, kubeconfig ports, admission webhooks from Kyverno, Pod Security
  Policies, quotas, and a kubeadm certificate renewal gone wrong.
publishedAt: 2022-04-08T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - kyverno
  - helm
  - artifacthub
show: klustered
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
guests:
  - leigh-capili
  - marcus-noble
resources:
  - title: Equinix Metal
    type: url
    category: other
  - title: Artifact Hub
    type: url
    url: 'https://artifacthub.io/'
    category: other
---

