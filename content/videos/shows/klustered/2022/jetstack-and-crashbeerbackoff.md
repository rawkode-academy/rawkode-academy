---
id: jetstack-and-crashbeerbackoff
slug: jetstack-and-crashbeerbackoff
title: Jetstack & CrashBeerBackOff
description: "#KubernetesTutorial\n\n⭐️ This episode was sponsored by Teleport & Equinix Metal ⭐️\n\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThanks to Equinix Metal for providing the hardware! Get 200USD credit with the code \"rawkode\". Learn more about Equinix Metal at https://rawkode.live/metal\n\n\U0001F37F Rawkode Live\n\nHosted by David Flanagan / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes"
publishedAt: 2022-08-12T17:00:00.000Z
technologies: []
show: klustered
videoId: sv0mv7oqjeu35421sjkffdou
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 127
    title: Introduction to Clustered and Guests
  - startTime: 159
    title: Sponsor Acknowledgments (Teleport & Equinix Metal)
  - startTime: 240
    title: Meet Team JetStack & Introductions
  - startTime: 303
    title: Starting with Cluster 1 (CrashBeerBackOff)
  - startTime: 348
    title: Troubleshooting Teleport Access Issues
  - startTime: 984
    title: Switching to Screen Sharing for Debugging
  - startTime: 1028
    title: Initial Investigation of Cluster 1
  - startTime: 1060
    title: Discovering Missing Control Plane Pods
  - startTime: 1107
    title: Checking Kubectl Executable Permissions
  - startTime: 1225
    title: Executing Kubectl via Loader
  - startTime: 1267
    title: 'Cluster 1: Kubelet Logs and Containerd Socket Errors'
  - startTime: 1398
    title: Restarting Containerd Service
  - startTime: 1437
    title: 'Checking Logs, Disk Space, and Inodes'
  - startTime: 1821
    title: Identifying and Fixing Containerd Log Size Limit
  - startTime: 1906
    title: 'Cluster 1: API Server Connectivity Issues'
  - startTime: 1941
    title: Attempting to Update Application Deployment (V1 to V2)
  - startTime: 2101
    title: Debugging Deployment Update Failure (Image Not Changing)
  - startTime: 2415
    title: Discovering and Fixing Disabled Deployment Controller
  - startTime: 2450
    title: 'Further Debugging: Deployment Update Still Failing'
  - startTime: 2581
    title: Investigating API Server Connection Details
  - startTime: 3011
    title: Hint Points to Networking & IP Tables / NFTables
  - startTime: 3087
    title: Debugging NFTables Rules
  - startTime: 3306
    title: Debugging IP Tables NAT Rules
  - startTime: 3355
    title: Fixing IP Tables NAT Redirect for API Server
  - startTime: 3485
    title: 'Cluster 1: Out of Time / Final Status Check'
  - startTime: 3545
    title: 'Cluster 1 Breaks Revealed (Proxy, Dry Run, IP Tables)'
  - startTime: 3648
    title: Transitioning to Cluster 2 (JetStack)
  - startTime: 3835
    title: Initial Investigation of Cluster 2
  - startTime: 3876
    title: Discovering Missing API Server Pod & Checking Manifest
  - startTime: 3956
    title: Checking Kubelet Logs on Control Plane
  - startTime: 4006
    title: Inspecting API Server Static Manifest
  - startTime: 4063
    title: Identifying and Fixing Incorrect API Server Secure Port
  - startTime: 4143
    title: API Server Starts Running
  - startTime: 4333
    title: 'Cluster 2: Application Pods Terminating/Pending (Nodes Not Ready)'
  - startTime: 4406
    title: Debugging Kubelet Status on Worker Node
  - startTime: 4443
    title: Checking Worker Kubelet Logs (CA File Error)
  - startTime: 4529
    title: Identifying and Fixing Kubelet Service File Path Typo
  - startTime: 4594
    title: Worker Node Becomes Ready
  - startTime: 4637
    title: 'Cluster 2: Application Pod DNS Issue (Name Resolution Failure)'
  - startTime: 4656
    title: Debugging DNS on Worker Node (Host DNS Working)
  - startTime: 4727
    title: Discovering and Fixing DNS Redirect Rule in IP Tables
  - startTime: 4810
    title: 'Cluster 2: Application Pod Scheduling Issue (Unschedulable)'
  - startTime: 4838
    title: Inspecting Deployment for Scheduling Constraints (nodeName)
  - startTime: 4867
    title: Fixing Hardcoded nodeName in Deployment
  - startTime: 4901
    title: Application Still Running V1 / Image Pull Issue
  - startTime: 4925
    title: Forcing Image Pull with Always Policy
  - startTime: 4962
    title: Application Now Running V2 / Cluster 2 Fixed
  - startTime: 5066
    title: Removing Scheduler Name Constraint (Optional Fix)
  - startTime: 5094
    title: Cluster 2 Breaks Revealed
  - startTime: 5117
    title: 'Wrap-up, Thanks, and Reflections'
duration: 5355
---

