---
id: introduction-to-cilium
slug: introduction-to-cilium
title: Introduction to Cilium
description: "In this episode, joined by Ilya Dmitrichenko, we'll take a look at Cilium; a CNI implementation for Kubernetes, integrated with eBPF.\n\nCilium is open source software for transparently securing the network connectivity between application services deployed using Linux container management platforms like Docker and Kubernetes.\n\nAt the foundation of Cilium is a new Linux kernel technology called BPF, which enables the dynamic insertion of powerful security visibility and control logic within Linux itself. Because BPF runs inside the Linux kernel, Cilium security policies can be applied and updated without any changes to the application code or container configuration.\n\n\U0001F570    Timeline\n\n00:00 - Holding screen\n03:05 - Introductions\n04:30 - Installing Cilium with the Quickstart\n08:50 - Running the Cilium connectivity tests\n11:50 - Connectivity test failures: IPAM range is full\n15:00 - Changing the IPv4 CIDR\n16:00 - Deleting the Cilium pods to force a config reload\n18:50 - Using the Cilium CLI to fetch Cilium status\n20:20 - Lets just delete everything and start again \U0001F605\n26:30 - Lets try minikube ...\n30:30 - What is the Container Networking Interface (CNI)?\n35:00 - Advantages of Cilium\n39:30 - Deploying the Star Wars demo to our cluster\n41:00 - What is Hubble?\n42:00 - Back to Star Wars demo\n43:30 - Debugging Cilum Endpoints / What are Cilium Endpoints\n45:50 - Lets delete minikube and start again \U0001F605\n48:00 - Now CoreDNS can't get an IP address \U0001F600\n49:00 - Lets go back to our Packet cluster\n55:00 - Deploying Cilium again, this time with Helm\n58:00 - IPAM range is full \U0001F605\n1:06:00 - Lets reboot all our nodes ...\n1:06:20 - Summary of what has gone wrong thus far\n1:16:00 - Lets delete Cilium node CRDs \n1:17:00 - Cilium is working ... but DNS isn't \n\n\nPart II coming soon!\n\n\n\U0001F481\U0001F3FB‍♂️    Want some help?\n\n\U0001F4AC  Leave a comment\n\U0001F426  Ping me on Twitter - https://twitter.com/rawkode\n\U0001F4C6  Schedule some time during my office-hours - https://rawko.de/office-hours\n\n\n\U0001F30E    Links\n\nIlya Dmitrichenko - https://twitter.com/errordeveloper\nCilium - https://cilium.io/"
publishedAt: 2020-09-25T17:00:00.000Z
technologies:
  - cilium
show: rawkode-live
videoId: w6ui2iu1ib1yzoir8k1bolqa
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 185
    title: Introductions
  - startTime: 186
    title: 'Introduction and Plan (Install First, Explain Later)'
  - startTime: 246
    title: Initial Cilium Installation Attempt (Quickstart)
  - startTime: 270
    title: Installing Cilium with the Quickstart
  - startTime: 413
    title: 'Troubleshooting Installation Issues (Wrong Cluster, Initial Crashes)'
  - startTime: 530
    title: Running the Cilium connectivity tests
  - startTime: 536
    title: Running the Cilium Connectivity Test
  - startTime: 701
    title: Debugging IPAM Configuration (Range Full Error)
  - startTime: 710
    title: 'Connectivity test failures: IPAM range is full'
  - startTime: 900
    title: Changing the IPv4 CIDR
  - startTime: 926
    title: Modifying Cilium Configuration (Changing IPAM CIDR)
  - startTime: 960
    title: Deleting the Cilium pods to force a config reload
  - startTime: 976
    title: Re-applying Configuration and Further Debugging
  - startTime: 1076
    title: Connectivity Test Still Failing
  - startTime: 1130
    title: Using the Cilium CLI to fetch Cilium status
  - startTime: 1220
    title: Lets just delete everything and start again
  - startTime: 1468
    title: 'Switching Strategy: Using Helm for Installation'
  - startTime: 1586
    title: Attempting Installation on Minikube
  - startTime: 1590
    title: Lets try minikube ...
  - startTime: 1830
    title: What is the Container Networking Interface (CNI)?
  - startTime: 1841
    title: 'Understanding CNI and Cilium''s Capabilities (eBPF, Kube-proxy, L7 Policy)'
  - startTime: 2100
    title: Advantages of Cilium
  - startTime: 2370
    title: Deploying the Star Wars demo to our cluster
  - startTime: 2460
    title: What is Hubble?
  - startTime: 2477
    title: Introducing Hubble (Visibility Tool)
  - startTime: 2520
    title: Back to Star Wars demo
  - startTime: 2577
    title: Attempting the Star Wars Demo Application
  - startTime: 2610
    title: Debugging Cilum Endpoints / What are Cilium Endpoints
  - startTime: 2730
    title: Minikube Troubleshooting (Docker for Mac Driver Issues)
  - startTime: 2750
    title: Lets delete minikube and start again
  - startTime: 2880
    title: Now CoreDNS can't get an IP address
  - startTime: 2890
    title: Returning to Packet Cluster Debugging
  - startTime: 2940
    title: Lets go back to our Packet cluster
  - startTime: 3186
    title: 'Advanced Debugging: IPAM and Lingering State'
  - startTime: 3300
    title: 'Deploying Cilium again, this time with Helm'
  - startTime: 3480
    title: IPAM range is full
  - startTime: 3960
    title: Lets reboot all our nodes ...
  - startTime: 3979
    title: 'Troubleshooting: Rebooting Nodes to Clear State'
  - startTime: 3980
    title: Summary of what has gone wrong thus far
  - startTime: 4334
    title: Cluster Recovery and Post-Reboot Checks
  - startTime: 4560
    title: Lets delete Cilium node CRDs
  - startTime: 4620
    title: Cilium is working ... but DNS isn't
  - startTime: 4644
    title: 'Troubleshooting: Clearing Stale CRDs (CiliumNode)'
  - startTime: 4738
    title: Final Cilium Pod Restart and Verification
  - startTime: 4873
    title: Connectivity Test Results (Starting to Succeed)
  - startTime: 4914
    title: Re-attempting Star Wars Demo
  - startTime: 5101
    title: 'Troubleshooting Demo: DNS Resolution Issues'
  - startTime: 5251
    title: Conclusion and Future Steps (Addressing Remaining Issues)
duration: 5382
---

