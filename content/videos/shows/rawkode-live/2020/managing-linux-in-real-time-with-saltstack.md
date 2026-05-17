---
id: akvx71sbz8fsyk50yhcde4vz
slug: managing-linux-in-real-time-with-saltstack
title: Managing Linux in Real Time with SaltStack
description: >-
  Edward Vielmetti joins to provision a mixed Ubuntu, CentOS and FreeBSD fleet
  on Packet bare metal using Pulumi with TypeScript, then drive it with Salt:
  bootstrap, grains, pillars, targeting, and state modules for cron, files and
  SSH keys.
publishedAt: 2020-09-17T17:00:00.000Z
type: live
category: tutorial
technologies:
  - pulumi
  - salt
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 120
    title: Introductions
  - startTime: 300
    title: >-
      Deploying a heterogeneous cluster (Machines and OS) with SaltStack on
      Packet’s bare metal with Pulumi and TypeScript
  - startTime: 1050
    title: Extending SaltStack with Packet’s metadata as grains
  - startTime: 1110
    title: 'Covering SaltStack’s Vocabulary: Grains and Pillars'
  - startTime: 1350
    title: Binding SaltStack to the private IPv4 address
  - startTime: 1440
    title: >-
      Ed has a cool use-case for Tailscale, connecting his SaltStack nodes over
      disparate private networks
  - startTime: 1590
    title: Connecting to our SaltStack master / Checking it works!
  - startTime: 1680
    title: Approving our first minion key
  - startTime: 1760
    title: >-
      Oops! Our provisioning on the CentOS machine failed. Lets fix it (Fuck
      you, Python 2)
  - startTime: 2220
    title: Introduction to SaltStack CLI
  - startTime: 2300
    title: Executing remote commands on minions
  - startTime: 2340
    title: Targeting minions
  - startTime: 2400
    title: Querying grains
  - startTime: 3120
    title: 'Fixing the Ubuntu machine (Fuck you, Python 2)'
  - startTime: 3370
    title: 'SaltStack communication method. Spoiler: event driven through zero-mq'
  - startTime: 3520
    title: 'Python / wheel on Arm needs compiled, so it’s a bit slower.'
  - startTime: 3570
    title: Installing software to our minions through SaltStack’s package module
  - startTime: 4020
    title: Looking at state modules
  - startTime: 4140
    title: Writing our first state using the cron state module
  - startTime: 4380
    title: Running a single state from the file root
  - startTime: 4440
    title: >-
      Adding the file state module to our first state: creating a directory and
      writing a file
  - startTime: 5205
    title: Provisioning all our machines with SSH keys from our custom grain data
duration: 6520
guests:
  - edward-vielmetti
resources:
  - title: Salt Pillar Modules documentation
    type: url
    url: 'https://docs.saltproject.io/en/latest/topics/pillar/'
    category: documentation
  - title: Salt Targeting documentation
    type: url
    url: 'https://docs.saltproject.io/en/latest/topics/targeting/'
    category: documentation
  - title: Salt State Modules documentation
    type: url
    url: 'https://docs.saltproject.io/en/latest/ref/states/all/'
    category: documentation
  - title: Salt Bootstrap
    type: url
    url: 'https://github.com/saltstack/salt-bootstrap'
    category: code
---

