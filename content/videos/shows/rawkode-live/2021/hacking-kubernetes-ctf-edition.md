---
id: h9myn3s1d0z4rjleaspu4z2f
slug: hacking-kubernetes-ctf-edition
title: 'Hacking Kubernetes: CTF Edition'
description: >-
  Andrew Martin of Control Plane walks David through Kubernetes CTF scenarios
  from KubeCon: escaping via host mounts, killing crypto-miner deployments
  through RBAC gaps, executing commands blindly via log streams, and pivoting
  between containers via shared process namespaces.
publishedAt: 2021-05-14T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 40
    title: Introductions
  - startTime: 49
    title: Introduction & Housekeeping
  - startTime: 94
    title: Guest Introduction & Background
  - startTime: 233
    title: Introduction to the KubeCon CTF
  - startTime: 243
    title: CTF Platform & Availability
  - startTime: 384
    title: Setting up Scenario 1
  - startTime: 390
    title: CTF 1
  - startTime: 430
    title: Scenario 1 Context (Captain Hashjack)
  - startTime: 523
    title: 'Scenario 1: Recon - Discovering Host Mount'
  - startTime: 615
    title: CTF Strategy & Flag Format
  - startTime: 700
    title: 'Scenario 1: Searching for Flag 1'
  - startTime: 907
    title: 'Scenario 1: Flag Found & Analysis (Persistence)'
  - startTime: 1114
    title: Scenario 1 Conclusion
  - startTime: 1119
    title: Setting up Scenario 2
  - startTime: 1140
    title: CTF 2
  - startTime: 1163
    title: 'Scenario 2: Initial & Advanced Recon'
  - startTime: 1565
    title: 'Scenario 2: Checking Kubernetes Permissions'
  - startTime: 1587
    title: Scenario 2 Context (Unexpected Workloads)
  - startTime: 1645
    title: 'Scenario 2: Goal & Strategy (Stop Miners)'
  - startTime: 1696
    title: 'Scenario 2: Deleting Workloads'
  - startTime: 1815
    title: 'Scenario 2: Workloads Stopped & Flag Found'
  - startTime: 1843
    title: 'Scenario 2: Flag Analysis (Operator)'
  - startTime: 1860
    title: CTF 3
  - startTime: 1864
    title: Scenario 2 Conclusion
  - startTime: 1868
    title: Setting up Scenario 3
  - startTime: 1873
    title: Scenario 3 Context (Supply Chain)
  - startTime: 1889
    title: 'Scenario 3: Initial Recon & Permissions'
  - startTime: 2020
    title: 'Scenario 3: Strategy (Run Compromised Image)'
  - startTime: 2114
    title: 'Scenario 3: Executing Commands Blindly via Logs'
  - startTime: 2372
    title: 'Scenario 3: Flag Found'
  - startTime: 2376
    title: 'Scenario 3: Flag Analysis'
  - startTime: 2400
    title: Playing with amicontained
  - startTime: 2404
    title: Scenario 3 Conclusion
  - startTime: 2421
    title: Setting up Scenario 4 & Cluster Stability
  - startTime: 2463
    title: 'Scenario 4: Initial Recon'
  - startTime: 2491
    title: Cluster Self-Destructs
  - startTime: 2497
    title: Scenario 4 Context (Shared Process Namespace)
  - startTime: 2595
    title: 'Scenario 4: Multiple Containers Hint'
  - startTime: 2668
    title: Cluster Setup Issues
  - startTime: 2737
    title: Security Tools & Concepts Discussion
  - startTime: 3060
    title: CTF 4
  - startTime: 3132
    title: 'Returning to Scenario 4: Shared Process Namespace'
  - startTime: 3232
    title: 'Scenario 4: Accessing Other Container''s Filesystem via /proc'
  - startTime: 3299
    title: 'Scenario 4: Finding the Flag'
  - startTime: 3368
    title: Scenario 4 Conclusion & Future
  - startTime: 3385
    title: Wrap up Discussion
  - startTime: 3445
    title: User Namespaces & Mitigation
  - startTime: 3505
    title: Final Remarks
duration: 3574
guests:
  - andrew-martin
resources:
  - title: Kubernetes Simulator
    type: url
    url: 'https://github.com/controlplaneio/simulator'
    category: code
  - title: Hacking Kubernetes book
    type: url
    url: 'https://www.oreilly.com/library/view/hacking-kubernetes/9781492081722/'
    category: other
  - title: Am I Contained
    type: url
    url: 'https://github.com/genuinetools/amicontained'
    category: code
  - title: Stern Kubernetes log tailing tool
    type: url
    url: 'https://github.com/stern/stern'
    category: code
  - title: Bane AppArmor profile tool
    type: url
    url: 'https://github.com/genuinetools/bane'
    category: code
---

