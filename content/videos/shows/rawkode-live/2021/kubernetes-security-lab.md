---
id: kubernetes-security-lab
slug: kubernetes-security-lab
title: Kubernetes Security Lab
description: "In this episode, Rory will run us through his Kubernetes Security Lab\n#KubernetesTutorial #Tutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:30 - Introductions\n02:00 - What is the Security Lab?\n06:20 - Launching the Client Machine\n11:00 - Lab 1: APIServer Insecure Port\n26:40 - Lab 2: Kubelet NoAuth\n40:00 - Lab 3: Etcd NoAuth\n57:00 - Lab 4: Privileged Pod\n1:09:00 - Lab 5: Helm 2's Tiller\n\n\U0001F465 About the Guests\n\nRory McCune\n\n  AquaSecurity\n\n\n\U0001F426 https://twitter.com/raesene\n\U0001F9E9 https://github.com/raesene\n\U0001F30F https://raesene.github.io/\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-04-15T17:00:00.000Z
technologies:
  - kubernetes
show: rawkode-live
videoId: abih5lxnfz58vl1ariozmar5
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 42
    title: Housekeeping & Sponsor
  - startTime: 91
    title: 'Introducing the Guest, Rory McKeon'
  - startTime: 119
    title: Lab Purpose and Overview
  - startTime: 120
    title: What is the Security Lab?
  - startTime: 184
    title: Environment Setup with Kind and Docker
  - startTime: 291
    title: Getting Started with the Lab Format
  - startTime: 320
    title: Overview of Vulnerable Cluster Scenarios
  - startTime: 380
    title: Launching the Client Machine
  - startTime: 386
    title: Setting up the Client Machine
  - startTime: 587
    title: Selecting the First Scenario
  - startTime: 660
    title: 'Lab 1: APIServer Insecure Port'
  - startTime: 694
    title: Setting up the Insecure Port Scenario
  - startTime: 755
    title: 'Attacking Scenario 1: Insecure Port (Nmap & kubectl Access)'
  - startTime: 1160
    title: 'Discussion: Insecure Port vs Read-Only Kubelet Port'
  - startTime: 1200
    title: 'Lab Objective: Obtaining the CA Private Key'
  - startTime: 1258
    title: 'Attacking Scenario 1: Obtaining CA Key via kubectl exec'
  - startTime: 1378
    title: 'Discussion: Defending Against CA Key Access & Backup Risks'
  - startTime: 1468
    title: 'Q&A: QBADM Defaults & Distribution Security'
  - startTime: 1562
    title: Cleaning Up Scenario 1
  - startTime: 1600
    title: 'Lab 2: Kubelet NoAuth'
  - startTime: 1606
    title: Setting up the Kubelet No Auth Scenario
  - startTime: 1645
    title: 'Discussion: Kubelet API and its Use'
  - startTime: 1791
    title: 'Attacking Scenario 2: Kubelet No Auth (Probe & Nmap)'
  - startTime: 1866
    title: 'Discussion: Kubelet Read-Only vs Read-Write Ports'
  - startTime: 1917
    title: 'Attacking Scenario 2: Kubelet No Auth (Curl Access)'
  - startTime: 2155
    title: 'Discussion: Kubelet Exploit & Crypto Mining'
  - startTime: 2400
    title: 'Lab 3: Etcd NoAuth'
  - startTime: 2409
    title: 'Discussion: Securing the Kubelet API & Scanning Tools'
  - startTime: 2425
    title: Setting up the ETCD No Auth Scenario
  - startTime: 2487
    title: 'Q&A: QBADM Defaults & ETCD Security'
  - startTime: 2686
    title: Cleaning Up Scenario 2
  - startTime: 2700
    title: 'Attacking Scenario 3: ETCD No Auth (Nmap & etcdctl Access)'
  - startTime: 2916
    title: 'Discussion: ETCD Secrets and Encryption'
  - startTime: 2965
    title: 'Attacking Scenario 3: Obtaining Service Account Token from ETCD'
  - startTime: 3051
    title: 'Attacking Scenario 3: Using the Stolen Token'
  - startTime: 3099
    title: 'Attacking Scenario 3: Verifying Cluster Admin Privileges'
  - startTime: 3136
    title: 'Discussion: Dangers of Cluster Admin and RBAC'
  - startTime: 3311
    title: 'Attacking Scenario 3: Obtaining CA Key using Stolen Token'
  - startTime: 3370
    title: 'Discussion: RBAC and Installer Risks'
  - startTime: 3420
    title: 'Lab 4: Privileged Pod'
  - startTime: 3428
    title: Setting up the Create Pods Easy Scenario
  - startTime: 3546
    title: 'Discussion: Reproducible Labs with Kind and Ansible'
  - startTime: 3605
    title: 'Lab Goal: Privilege Escalation Scenarios'
  - startTime: 3640
    title: 'Attacking Scenario 4: Create Pods Easy (Initial SSH Access)'
  - startTime: 3685
    title: 'Attacking Scenario 4: Checking Initial Permissions'
  - startTime: 3738
    title: 'Attacking Scenario 4: Identifying Exploit (Create Pod + Host Volumes)'
  - startTime: 3773
    title: 'Attacking Scenario 4: Examining the Key Dumper Manifest'
  - startTime: 3798
    title: 'Attacking Scenario 4: Creating the Malicious Pod'
  - startTime: 3820
    title: 'Attacking Scenario 4: Obtaining CA Key via Malicious Pod'
  - startTime: 3824
    title: 'Discussion: Create Pod + Host Path Vulnerability'
  - startTime: 3909
    title: 'Discussion: Mitigation Strategies (Admission Controllers)'
  - startTime: 4027
    title: 'Discussion: Multitenancy & Alternative Runtimes'
  - startTime: 4140
    title: 'Lab 5: Helm 2''s Tiller'
  - startTime: 4227
    title: Setting up the Tiller No Auth Scenario
  - startTime: 4231
    title: 'Discussion: Tiller (Helm v2) Vulnerability'
  - startTime: 4316
    title: 'Discussion: Tiller Authentication Default'
  - startTime: 4378
    title: 'Discussion: Helm, Operators, and Permissions'
  - startTime: 4511
    title: 'Attacking Scenario 5: Tiller No Auth (Nmap Scan)'
  - startTime: 4576
    title: 'Discussion: Node Port Risks'
  - startTime: 4603
    title: 'Attacking Scenario 5: Accessing Tiller via Helm Two CLI'
  - startTime: 4688
    title: 'Attacking Scenario 5: Identifying Malicious Helm Chart'
  - startTime: 4699
    title: 'Attacking Scenario 5: Installing the Malicious Chart'
  - startTime: 4715
    title: 'Attacking Scenario 5: SSHing to the Privileged Container'
  - startTime: 4779
    title: 'Attacking Scenario 5: Accessing the Host File System (CA Key)'
  - startTime: 4816
    title: Summary of Tiller Exploit Chain
  - startTime: 4862
    title: Reflection and Future Security Considerations
  - startTime: 4978
    title: Conclusion and Call to Action
  - startTime: 5017
    title: Outro
duration: 5064
---

