---
id: w6ui2iu1ib1yzoir8k1bolqa
slug: introduction-to-cilium
title: Introduction to Cilium
description: >-
  Ilya Dmitrichenko joins David to install Cilium on a Cluster API cluster,
  debug IPAM and stale CiliumNode CRDs, and walk through eBPF-powered kube-proxy
  replacement, L7 policy, and Hubble visibility via the Star Wars demo.
publishedAt: 2020-09-25T17:00:00.000Z
type: live
category: tutorial
technologies:
  - cilium
  - ebpf
  - kubernetes
  - helm
  - cluster-api
show: rawkode-live
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
guests:
  - errordeveloper
resources:
  - title: Cilium Quick Installation guide
    type: url
    url: 'https://docs.cilium.io/en/stable/gettingstarted/k8s-install-default/'
    category: documentation
  - title: Cilium IPAM documentation
    type: url
    url: 'https://docs.cilium.io/en/stable/network/concepts/ipam/'
    category: documentation
  - title: Cilium connectivity test manifest
    type: url
    url: >-
      https://github.com/cilium/cilium/tree/master/examples/kubernetes/connectivity-check
    category: demos
  - title: Cilium Star Wars demo
    type: url
    url: 'https://docs.cilium.io/en/stable/gettingstarted/demo/'
    category: demos
  - title: Introduction to Cilium and Hubble
    type: url
    url: 'https://docs.cilium.io/en/stable/overview/intro/'
    category: documentation
---

