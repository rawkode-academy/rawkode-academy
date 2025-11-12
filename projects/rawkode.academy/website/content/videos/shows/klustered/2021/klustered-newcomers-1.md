---
id: klustered-newcomers-1
slug: klustered-newcomers-1
title: 'Klustered: Newcomers #1'
description: "Klustered is a live debugging and competitive Kubernetes series that aims to provide the best CKA, CKAD, and CKS training materials on YouTube.\nThis is the Newcomers edition which will stick to the primitives you need to learn to operate and debug production Kubernetes clusters. \n#KubernetesTutorial #Tutorial\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - This Video\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewer Comments\n00:50 - Introductions\n05:00 - kubeadm KUBECONFIG\n08:00 - kubectl get pods\n08:30 - kubectl describe pods\n16:50 - Containerd logs\n18:20 - Kubelet logs\n19:45 - kubectl describe deployment\n23:20 - kubectl edit deployment\n28:00 - Pod Requests & Limits\n35:00 - Liveness & Readiness Probes\n39:00 - Static Pod Manifests\n43:00 - Debugging Kubernetes Services\n47:00 - kubectl scale\n54:30 - ImagePullPolicies\n1:00:00 - Service Endpoints\n\n\U0001F465 About the Guests\n\nThom Crowe\n\n  .\n\n\n\U0001F426 https://twitter.com/thomcrowe\n\U0001F9E9 https://github.com/thomcrowe\n\n\n\nJeremy Tanner\n\n  .\n\n\n\U0001F426 https://twitter.com/penguin\n\U0001F9E9 https://github.com/jeremytanner\n\n\n\n\U0001F528 About the Technologies\n\nKubernetes\n\nKubernetes is a portable, extensible, open-source platform for managing containerized workloads and services, that facilitates both declarative configuration and automation. It has a large, rapidly growing ecosystem. Kubernetes services, support, and tools are widely \navailable.\nThe name Kubernetes originates from Greek, meaning helmsman or pilot. Google open-sourced the Kubernetes project in 2014. Kubernetes combines over 15 years of Google's experience running production workloads at scale with best-of-breed ideas and practices from the community.\nDesigned on the same principles that allows Google to run billions of containers a week, Kubernetes can scale without increasing your ops team.\nWhether testing locally or running a global enterprise, Kubernetes flexibility grows with you to deliver your applications consistently and easily no matter how complex your need is.\nKubernetes is open source giving you the freedom to take advantage of on-premises, hybrid, or public cloud infrastructure, letting you effortlessly move workloads to where it matters to you.\n\n\U0001F30F https://kubernetes.io/\n\U0001F426 https://twitter.com/kubernetesio\n\U0001F9E9 https://github.com/kubernetes/kubernetes\n\n#CloudNative #Kubernetes"
publishedAt: 2021-05-28T17:00:00.000Z
technologies: []
show: klustered
videoId: phimrqhbsfj1y0gl2as0s3ce
chapters:
  - startTime: 0
    title: Viewer Comments
  - startTime: 50
    title: Introductions
  - startTime: 61
    title: Introduction and Show Premise
  - startTime: 112
    title: Guest Introductions
  - startTime: 244
    title: Connecting to the Cluster
  - startTime: 300
    title: kubeadm KUBECONFIG
  - startTime: 304
    title: Initial Troubleshooting Strategy
  - startTime: 379
    title: Checking Kubernetes API Server Connection
  - startTime: 480
    title: kubectl get pods
  - startTime: 492
    title: Listing Pods in All Namespaces
  - startTime: 510
    title: kubectl describe pods
  - startTime: 518
    title: Investigating the Failing Application Pod
  - startTime: 628
    title: 'Analyzing Pod Description: Sandbox Error & Port Mismatch'
  - startTime: 666
    title: Troubleshooting Sandbox Creation Issues
  - startTime: 811
    title: Finding Pod Node Assignment
  - startTime: 889
    title: Connecting to the Problematic Node
  - startTime: 1010
    title: Containerd logs
  - startTime: 1100
    title: Kubelet logs
  - startTime: 1180
    title: Describing the Application Deployment
  - startTime: 1185
    title: kubectl describe deployment
  - startTime: 1336
    title: Confirming Correct Application Port
  - startTime: 1400
    title: kubectl edit deployment
  - startTime: 1401
    title: 'Editing Deployment: Fixing Port Mismatch (8081 to 8080)'
  - startTime: 1516
    title: Checking Pod Status After Port Fix
  - startTime: 1578
    title: 'Analyzing New Pod Describe: Resource Limits Issue (1Mi memory)'
  - startTime: 1680
    title: Pod Requests & Limits
  - startTime: 1957
    title: 'Editing Deployment: Increasing Memory Limit'
  - startTime: 1985
    title: Application Pod Running/Ready (Problem 1 Solved)
  - startTime: 2026
    title: 'Investigating Kube-System Pods: Scheduler Issue'
  - startTime: 2100
    title: Liveness & Readiness Probes
  - startTime: 2133
    title: 'Describing the Scheduler Pod: Identifying Startup Delay'
  - startTime: 2281
    title: Fixing Static Pod Manifests (Scheduler Delay)
  - startTime: 2340
    title: Static Pod Manifests
  - startTime: 2490
    title: Checking Scheduler Status After Fix
  - startTime: 2580
    title: Debugging Kubernetes Services
  - startTime: 2586
    title: 'All Pods Running, Application Still Unreachable'
  - startTime: 2711
    title: 'Troubleshooting Application: Database Connection'
  - startTime: 2751
    title: Checking for Database (StatefulSet)
  - startTime: 2817
    title: Identifying StatefulSet Replicas = 0
  - startTime: 2820
    title: kubectl scale
  - startTime: 2871
    title: Scaling the Database StatefulSet
  - startTime: 2984
    title: 'Database Pod Running, Application Still Failing'
  - startTime: 3077
    title: Troubleshooting Application Pod Again (Checking YAML)
  - startTime: 3121
    title: 'Analyzing Application Pod YAML: CPU Limit Issue ("1")'
  - startTime: 3186
    title: 'Editing Deployment: Fixing CPU Limit and Image Pull Policy'
  - startTime: 3270
    title: ImagePullPolicies
  - startTime: 3332
    title: 'Checking Pod Status: CPU Limit Resolved (Pod Pending)'
  - startTime: 3437
    title: 'Editing Deployment: Fixing Image Pull Policy ("Never" to "Always")'
  - startTime: 3493
    title: 'Editing Deployment: Fixing CPU Limit Again ("1" to "1000m")'
  - startTime: 3557
    title: 'Pod Running/Ready, Application Still Timing Out: Checking Services'
  - startTime: 3600
    title: Service Endpoints
  - startTime: 3677
    title: Describing the Postgres Service
  - startTime: 3752
    title: 'Analyzing Service: No Endpoints'
  - startTime: 3925
    title: 'Identifying Label Mismatch: Service Selector vs. Pod Label'
  - startTime: 4037
    title: Editing Service Selector to Match Pod Labels
  - startTime: 4189
    title: Application Access Confirmed!
  - startTime: 4210
    title: Conclusion and Lessons Learned
  - startTime: 4522
    title: Checking Containerd and Kubelet Status/Logs
duration: 4350
---

