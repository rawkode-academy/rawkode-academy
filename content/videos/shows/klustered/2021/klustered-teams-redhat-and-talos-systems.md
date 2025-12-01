---
id: klustered-teams-redhat-and-talos-systems
slug: klustered-teams-redhat-and-talos-systems
title: 'Klustered Teams: RedHat & Talos Systems'
description: "#Klustered Teams: RedHat & Talos Systems\nKubernetes live debugging\n#KubernetesTutorial\n⭐️ This episode was sponsored by Teleport ⭐️\nWe use Teleport every week on Klustered and we encourage you to try it out too. Check them out at https://rawkode.live/teleport\n\nThis episode is part of the Klustered series.\n  -- Klustered (Part I) - https://youtu.be/teB22ZuV_z8\n  -- Klustered (Part II) - https://youtu.be/JzGv36Pcq3g\n  -- Klustered (Part III) - https://youtu.be/Ps2CQm6_aZU\n  -- Klustered (Part IV) - https://youtu.be/Cp6zvBIo5KM\n  -- Klustered (Part V) - https://youtu.be/Ju1WmHfK6t8\n  -- Klustered (Part VI) - https://youtu.be/tmsqYWBTxEQ\n  -- Klustered (Part VII) - https://youtu.be/Pd90XGptVec\n  -- Klustered (Part VIII) - https://youtu.be/QFxJWPF-QDk\n  -- Klustered (Part VIII-II) - https://youtu.be/1f6KTDo5WEo\n  -- Klustered #9 - https://youtu.be/RGaUhqgrsXE\n  -- Klustered #10 - https://youtu.be/K72fOdbxXu8\n  -- Klustered #11 - https://youtu.be/ysfUgYs4YYY\n  -- Klustered: Newcomers #1 - https://youtu.be/H2227nrkhOg\n  -- Klustered #13 - https://youtu.be/akJCvD0ASmw\n  -- Klustered #14 - https://youtu.be/5Rw7_1Yvm0U\n  -- Klustered #15 - https://youtu.be/4lMxlQ64Z7I\n  -- Klustered Teams: Container Solutions & Civo Cloud - https://youtu.be/ozbE25Y_rcM\n  -- Klustered Teams: RedHat & Talos Systems - This Video\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered Teams: DigitalOcean & Skyscanner - https://youtu.be/JvgpDTx1AZ0\n  -- Klustered Teams: Carta & Fairwinds - https://youtu.be/_GZ8UuEZxbY\n  -- Klustered: Community vs. Rawkode - https://youtu.be/_BFbrrXKMOM\n  -- Klustered #18 - https://youtu.be/z0Lf303tKtQ\n  -- Klustered #19 - https://youtu.be/-k5y2C6HNa0\n  -- Klustered Teams: Control Plane & Learnk8s - https://youtu.be/FClIbQ8hdxY\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:45 - Introductions\n05:00 - Team Talos\n46:00 - Team RedHat\n\n\U0001F465 About the Guests\n\nTalos Systems\n\n  Talos\n\n\n\U0001F426 https://twitter.com/talossystems\n\U0001F9E9 https://github.com/talos-systems\n\U0001F30F https://www.talos-systems.com/\n\n\nRedHat\n\n  RedHat\n\n\n\U0001F426 https://twitter.com/redhat\n\U0001F9E9 https://github.com/RedHatOfficial\n\U0001F30F https://www.redhat.com/\n\n\n\U0001F528 About the Technologies"
publishedAt: 2021-07-16T17:00:00.000Z
technologies: []
show: klustered
videoId: tzx0c1g2al9hmwgrzmhzpoap
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 105
    title: Introductions
  - startTime: 107
    title: Introduction and Housekeeping
  - startTime: 188
    title: Introducing Team Talos
  - startTime: 300
    title: Team Talos
  - startTime: 338
    title: 'Talos Team: Initial Cluster Check (Permission Denied)'
  - startTime: 610
    title: Bypassing Permissions with ld-linux
  - startTime: 975
    title: Replacing the kubectl Binary
  - startTime: 1149
    title: Fixing Shell Issues (Installing Fish)
  - startTime: 1203
    title: Identifying Certificate Expiration
  - startTime: 1241
    title: Attempting Certificate Renewal (kubadm)
  - startTime: 1348
    title: Restarting Control Plane Pods
  - startTime: 1456
    title: Talos Team Loses Teleport Access
  - startTime: 1564
    title: Regaining Access
  - startTime: 1653
    title: Debugging Kubelet and Static Pods
  - startTime: 1846
    title: Checking Application Status (Database Failed)
  - startTime: 1887
    title: Investigating Cilium Network Policies
  - startTime: 2427
    title: Identifying Default Cilium Policy
  - startTime: 2760
    title: Team RedHat
  - startTime: 3650
    title: Introducing Team Red Hat & Initial Cluster Check
  - startTime: 3701
    title: API Server Not Running
  - startTime: 3890
    title: Identifying the ETCD Issue
  - startTime: 4115
    title: ETCD Quorum Problems ("No Leader")
  - startTime: 4300
    title: Consulting Hints for ETCD
  - startTime: 4518
    title: 'Hint 1: Insufficient Quorum'
  - startTime: 4780
    title: Attempting to Remove Failed ETCD Member
  - startTime: 5132
    title: 'Hint 3: ETCD Snapshot Restore'
  - startTime: 5344
    title: Performing ETCD Snapshot Restore
  - startTime: 5610
    title: 'Kubectl Working, Worker Node Not Ready'
  - startTime: 5656
    title: Application (v1) is Accessible
  - startTime: 5672
    title: 'Red Hat Team: Attempting Application Upgrade'
  - startTime: 5755
    title: Application Pod Pending (Worker Node Issue)
  - startTime: 5969
    title: Consulting Hints for Worker Node
  - startTime: 6061
    title: 'Debugging Worker Node (Kubelet, Hostname)'
  - startTime: 6221
    title: Talos Team's Hostname Trick Revealed
  - startTime: 6258
    title: CNI Plugin Issue (Sandbox Error)
  - startTime: 6315
    title: Consulting Final Hints (Cilium CNI)
  - startTime: 6367
    title: Fixing the CNI Loopback Plugin
  - startTime: 6404
    title: Rescheduling the Application Pod
  - startTime: 6481
    title: Application (v2) is Working!
  - startTime: 6490
    title: Post-Challenge Discussion and Wrap-up
duration: 6609
---

