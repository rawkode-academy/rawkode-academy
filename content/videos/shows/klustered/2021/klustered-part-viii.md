---
id: dxx8gdculzrd3zyc6m8nuxms
slug: klustered-part-viii
title: Klustered (Part VIII)
description: >-
  Noel Georgi joins David to debug two broken Kubernetes clusters: a TLS 1.3
  handshake mismatch blocking the API server, and rogue Cilium host network
  policies plus a misconfigured native-routing-cidr breaking node readiness.
publishedAt: 2021-04-08T17:00:00.000Z
type: live
category: tutorial
technologies:
  - kubernetes
  - etcd
  - cilium
  - teleport
show: klustered
chapters:
  - startTime: 0
    title: Viewers Comments
  - startTime: 90
    title: Introductions
  - startTime: 97
    title: Introduction to Klustered Part VIII
  - startTime: 119
    title: Housekeeping & Community Shout-outs
  - startTime: 155
    title: Sponsor Thank You (Equinix Metal)
  - startTime: 176
    title: Introducing Guest Noel Georgie
  - startTime: 222
    title: Meeting the Breakers (Tim Hawken & Matt Anderson)
  - startTime: 270
    title: Kluster 015
  - startTime: 275
    title: 'Starting Debugging: Cluster 15 (Tim Hawken)'
  - startTime: 336
    title: Initial Cluster Check (API Server Unreachable)
  - startTime: 358
    title: Checking Kubeconfig and API Server Address
  - startTime: 385
    title: Verifying API Server Process is Running
  - startTime: 410
    title: API Server Port Check (Netcat/OpenSSL)
  - startTime: 467
    title: Examining API Server Manifest
  - startTime: 538
    title: Installing etcdctl for Debugging
  - startTime: 572
    title: Attempting etcd Health Check
  - startTime: 670
    title: Investigating Suspicious API Server Flags
  - startTime: 730
    title: Removing Suspicious API Server Flags & Restart
  - startTime: 795
    title: API Server Still Unreachable
  - startTime: 823
    title: Adding Verbose Logging for Debugging
  - startTime: 929
    title: Checking API Server Logs
  - startTime: 1246
    title: Finding Authentication Handshake Failed Error
  - startTime: 1547
    title: Checking API Server Certificates
  - startTime: 1620
    title: Examining etcd Certificates
  - startTime: 1658
    title: Checking etcd Logs
  - startTime: 1690
    title: Finding Errors in etcd Logs
  - startTime: 1881
    title: Re-testing API Server Port Connectivity
  - startTime: 2052
    title: Checking Certificate Expiry Dates
  - startTime: 2143
    title: Checking Running Processes (ps)
  - startTime: 2186
    title: Checking Firewall Status (UFW)
  - startTime: 2217
    title: Reviewing iptables Rules
  - startTime: 2469
    title: Re-examining API Server Static Pod Manifest
  - startTime: 2575
    title: Testing API Server with Curl
  - startTime: 2590
    title: Identifying TLS 1.3 Handshake
  - startTime: 2648
    title: Discussing Potential TLS Version Mismatch
  - startTime: 2970
    title: Kluster 016
  - startTime: 2974
    title: Moving to Cluster 16 (Matt Anderson)
  - startTime: 2985
    title: Connecting to Cluster 16
  - startTime: 3010
    title: Initial Cluster Check (Nodes Not Ready)
  - startTime: 3050
    title: Attempting Teleport Connection to Workers
  - startTime: 3119
    title: 'Manual SSH Success, Teleport Issue'
  - startTime: 3125
    title: Restarting Teleport Agents
  - startTime: 3188
    title: Suspecting Network Issues (Teleport Affected)
  - startTime: 3267
    title: Reviewing iptables on Worker Node
  - startTime: 3290
    title: Working from Control Plane Node (Cluster 16)
  - startTime: 3298
    title: Reviewing iptables on Control Plane
  - startTime: 3450
    title: Network Issues Confirmed (Private IP Ping Fail)
  - startTime: 3543
    title: Discovering Cilium Host Network Policies (CHNP)
  - startTime: 3636
    title: Examining Cilium Network Policies
  - startTime: 3729
    title: Deleting Suspicious Cilium Policies
  - startTime: 3788
    title: Teleport Agent Returns
  - startTime: 3816
    title: Nodes Starting to Become Ready
  - startTime: 3843
    title: Checking Cilium Pod Status
  - startTime: 3868
    title: Identifying Unready Node
  - startTime: 3883
    title: Restarting Teleport & Kubelet on Unready Node
  - startTime: 3960
    title: Verifying Node IP Addresses
  - startTime: 4003
    title: Checking Kubelet Logs on Unready Node
  - startTime: 4020
    title: Kubelet Connection Timeout to API Server
  - startTime: 4079
    title: Focusing on Kubernetes Resources (per Breaker Hint)
  - startTime: 4089
    title: Re-checking Cilium Network Policies
  - startTime: 4130
    title: Deleting Node-Specific Cilium Policies
  - startTime: 4266
    title: Nodes Getting Ready (One Still Unready)
  - startTime: 4330
    title: Deleting All Remaining Cilium Policies
  - startTime: 4347
    title: Restarting Kubelet (Attempt 3)
  - startTime: 4401
    title: Kubelet Logs Still Show Timeout
  - startTime: 4472
    title: Checking Admission Controllers
  - startTime: 4503
    title: Checking Static Admission Controllers
  - startTime: 4591
    title: Checking the Node Resource
  - startTime: 4609
    title: Verifying API Server IP in Kubelet Logs
  - startTime: 4651
    title: 'Hint: IPv4 Address Issue'
  - startTime: 4670
    title: Checking Cilium Endpoint for Node
  - startTime: 4692
    title: Suspecting Pod CIDR in Cilium Config
  - startTime: 4731
    title: Dumping Node Configs for Diff
  - startTime: 4816
    title: Diffing Node Configurations
  - startTime: 4832
    title: Identifying Cilium Host IP Discrepancy
  - startTime: 4896
    title: Checking Cilium ConfigMap
  - startTime: 4913
    title: 'Finding tunnel-mode: veth'
  - startTime: 4935
    title: Fixing tunnel-mode
  - startTime: 4937
    title: Confirming Pod CIDR Hint
  - startTime: 5020
    title: Reviewing Cilium ConfigMap CIDRs
  - startTime: 5059
    title: Checking Local Cilium ConfigMap
  - startTime: 5140
    title: Fixing native-routing-cidr in Cilium ConfigMap
  - startTime: 5161
    title: Fixing cluster-pool-ipv4-cidr
  - startTime: 5191
    title: Rolling Out Cilium Agent Restart
  - startTime: 5217
    title: All Cilium Pods Running
  - startTime: 5220
    title: Checking Node Status (Again)
  - startTime: 5230
    title: Restarting Kubelet (Attempt 4)
  - startTime: 5284
    title: 'Node Still Unready, Pods Terminating'
  - startTime: 5406
    title: Monitoring Kubelet Logs
  - startTime: 5454
    title: 'Hint: Check Kubernetes Service Endpoint'
  - startTime: 5468
    title: Checking Kubernetes Service Endpoints
  - startTime: 5492
    title: Identifying Incorrect Endpoint Target IP
  - startTime: 5548
    title: Re-testing API Server from Unready Node
  - startTime: 5620
    title: Ping to Private IP Fails
  - startTime: 5712
    title: Confirming Network Issue to Specific Node
  - startTime: 5740
    title: Focusing on Cluster Health Despite Ping Issue
  - startTime: 5758
    title: Re-checking API Server & Pods
  - startTime: 5768
    title: Postgres Pod Terminating on Bad Node
  - startTime: 5771
    title: Force Deleting Postgres Pod
duration: 5811
guests:
  - frezbo
resources:
  - title: kubectl neat
    type: url
    url: 'https://github.com/itaysk/kubectl-neat'
    category: code
---

