---
id: klustered-teams-digitalocean-and-skyscanner
slug: klustered-teams-digitalocean-and-skyscanner
title: 'Klustered Teams: DigitalOcean & Skyscanner'
description: "#Klustered Teams: DigitalOcean & Skyscanner\nKubernetes live debugging\n#KubernetesTutorial\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - https://youtu.be/IWz1XJnOR_g\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - This Video\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:50 - Introductions\n03:00 - Team Skyscanner\n42:00 - Team DigitalOcean\n\n\U0001F465 About the Guests\n\nDigitalOcean\n\n  Team:\nBillie Cleek / Twitter: bhcleek / GitHub: bhcleek\nCollin Shoop / GitHub: CollinShoop\nJeremy Morris / Twitter: MorrisLaw93 / GitHub: @MorrisLaw\nShahar Levy / GitHub: @Shahar\n\n\n\U0001F426 https://twitter.com/digitalocean\n\U0001F9E9 https://github.com/digitalocean\n\U0001F30F https://digitalocean.com\n\n\nSkyscanner\n\n  Team:\nGuy Templeton / Twitter: gjtempleton / GitHub: gjtempleton\nMatteo Ruina / Twitter: ruio / GitHub: maruina\nAlex Williams / Twitter:  smirl/ GitHub: smirl\n\n\n\U0001F426 https://twitter.com/skyscanner\n\U0001F9E9 https://github.com/skyscanner\n\U0001F30F https://skyscanner.com\n\n\n\U0001F528 About the Technologies"
publishedAt: 2021-07-30T17:00:00.000Z
technologies: []
show: klustered
videoId: lb152fahj4mgnkhcx1lsnejr
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 110
    title: Introductions
  - startTime: 111
    title: Introduction and Sponsor Mention
  - startTime: 175
    title: Introducing Team Skyscanner
  - startTime: 180
    title: Team Skyscanner
  - startTime: 216
    title: Skyscanner Team Introductions
  - startTime: 335
    title: 'Skyscanner''s Challenge Begins: Initial Cluster Access'
  - startTime: 377
    title: Debugging Connection Refused Errors
  - startTime: 483
    title: 'Checking Control Plane Components (Kubelet, Static Pods)'
  - startTime: 552
    title: Investigating API Server Config
  - startTime: 784
    title: Checking API Server Logs (TLS Issue Found)
  - startTime: 862
    title: Renewing Kubernetes Certificates
  - startTime: 910
    title: Restarting API Server and Checking Logs
  - startTime: 997
    title: Forcing Static Pod Restart via Manifest
  - startTime: 1060
    title: Continued API Server Log Analysis
  - startTime: 1121
    title: Investigating Etcd Logs
  - startTime: 1177
    title: API Server is Functional
  - startTime: 1189
    title: Identifying Unready Nodes
  - startTime: 1236
    title: Using k9s for Cluster Overview
  - startTime: 1297
    title: Diagnosing Pod Connectivity to API Server (from k9s errors)
  - startTime: 1334
    title: Considering Application Upgrade Strategy vs. Fixing CNI
  - startTime: 1374
    title: Persistent API Server Connection Issues (from k9s)
  - startTime: 1455
    title: Checking API Server Logs Again (Context Deadline)
  - startTime: 1500
    title: API Server Received Terminate Signal
  - startTime: 1526
    title: Etcd Member Status Check
  - startTime: 1596
    title: Chat Suggests Resource Limits Issue on Etcd
  - startTime: 2010
    title: Kubelet logs show Etcd container failing
  - startTime: 2049
    title: Checking Etcd Logs (Shutdown signal)
  - startTime: 2138
    title: Host Suggests Removing Probes and Limits from Etcd Manifest
  - startTime: 2236
    title: Checking Etcd Logs After Modification (Looks Healthy)
  - startTime: 2278
    title: Checking API Server Status (It works!)
  - startTime: 2362
    title: Attempting Application Update (Deploying v2)
  - startTime: 2402
    title: Application Accessible (Skyscanner Mission Success)
  - startTime: 2426
    title: Skyscanner Team Reflection
  - startTime: 2462
    title: Skyscanner Team Signs Off
  - startTime: 2479
    title: Intermission & Sponsor Thanks
  - startTime: 2519
    title: Introducing Team DigitalOcean
  - startTime: 2520
    title: Team DigitalOcean
  - startTime: 2630
    title: DigitalOcean Team Introductions
  - startTime: 2700
    title: 'DigitalOcean''s Challenge Begins: Cluster Access'
  - startTime: 2801
    title: Initial `kubectl` Fails (Unable to Handle Request)
  - startTime: 2900
    title: Checking Kubelet Logs
  - startTime: 17347
    title: Checking Etcd Status and Logs (Looks Okay)
  - startTime: 17499
    title: API Server Logs (Failing or Missing Response)
  - startTime: 17646
    title: Investigating API Server Manifest and Flags
  - startTime: 17749
    title: Verifying Virtual IP Address
  - startTime: 18068
    title: Cluster Info Command Fails
  - startTime: 18732
    title: Host Hints at API Server Startup Logs
  - startTime: 18966
    title: Looking for Anomaly in API Server Manifest
  - startTime: 19111
    title: Killing and Restarting API Server Process
  - startTime: 19510
    title: API Server Responds After Manual Restart (`kubectl get nodes` works)
  - startTime: 19820
    title: Investigating Webhook Configurations
  - startTime: 19900
    title: Deleting Validating Webhook Configuration
  - startTime: 20070
    title: Attempting Application Update
  - startTime: 20230
    title: Checking Application Access (Internal Server Error)
  - startTime: 20560
    title: Debugging Application Connectivity (Postgres DNS)
  - startTime: 20817
    title: Installing DNS Utils in Pod
  - startTime: 21010
    title: Checking Postgres DNS Resolution (Works)
  - startTime: 21270
    title: Checking Application Logs (No Logs Available)
  - startTime: 21390
    title: Re-examining Application Deployment/Binary
  - startTime: 21630
    title: Checking Services (Clustered and Postgres)
  - startTime: 21668
    title: Discussing Networking Issues (Cilium)
  - startTime: 21690
    title: Checking Network Policies
  - startTime: 21718
    title: Checking Cilium Pods/Daemonset (Recently Restarted)
  - startTime: 21900
    title: Checking Cilium Config Map (kube-proxy replacement disabled)
  - startTime: 22140
    title: Finding and Scaling Down kube-monkey Deployment
  - startTime: 22375
    title: Enabling kube-proxy Replacement in Cilium Config (Probe)
  - startTime: 22560
    title: Forcing Cilium Daemonset Rollout (Add label)
  - startTime: 22965
    title: Checking Application Access Again (Works!)
  - startTime: 23040
    title: DigitalOcean Mission Success & Reflection
  - startTime: 23460
    title: DigitalOcean Team Signs Off
  - startTime: 23508
    title: Outro and Sponsor Thanks
duration: 7050
---

