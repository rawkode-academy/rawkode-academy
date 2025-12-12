---
id: rwhw1lpmbqe2tfflabrd0ys9
slug: kubernetes-disaster-recovery
title: Kubernetes Disaster Recovery
subtitle: ''
description: |
  Kubernetes backups are simple in theory: etcd state plus persistent volumes. The real challenge is managing this across 50 clusters without drifting configs, scattered backup locations, and zero visibility.

  In this video, I'll show you:

  How Velero backs up both Kubernetes state and persistent volumes
  What actually happens during a restore when your cluster breaks
  Why PV-based backups beat operator-specific solutions for stateful workloads
  How Spectro Cloud's Palette eliminates the operational overhead at scale

  This is part of the Day Two Operations series with Spectro Cloud, focusing on the problems you hit after you've deployed Kubernetes.

  🔗 Resources:

  Spectro Cloud Palette Docs: https://docs.spectrocloud.com
  Velero: https://velero.io
publishedAt: 2025-11-25T14:00:00.000Z
type: recorded
category: tutorial
technologies:
  - kubernetes
  - velero
videoId: rwhw1lpmbqe2tfflabrd0ys9
chapters:
  - startTime: 0
    title: Intro
  - startTime: 68
    title: Setup
  - startTime: 310
    title: Velero
  - startTime: 459
    title: Backup
  - startTime: 596
    title: Disaster Strikes
  - startTime: 621
    title: Restore
duration: 1157
---
