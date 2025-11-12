---
id: managing-linux-in-real-time-with-saltstack
slug: managing-linux-in-real-time-with-saltstack
title: Managing Linux in Real Time with SaltStack
description: "In this episode, joined by my colleague Edward Vielmetti, we go through the installation and configuration of a SaltStack cluster for managing a heterogeneous collection of systems.\n\n\nSaltStack (often referred to as just Salt) is Python-based, open-source software for event-driven IT automation, remote task execution, and configuration management. Supporting the \"Infrastructure as Code\" approach to data center system and network deployment and management, configuration automation, SecOps orchestration, vulnerability remediation, and hybrid cloud control. \n\n\n\U0001F570    Timeline\n\n00:00 - Holding Screen\n02:00 - Introductions\n05:00 - Deploying a heterogeneous cluster (Machines and OS) with SaltStack on Packet’s bare metal with Pulumi and TypeScript\n17:30 - Extending SaltStack with Packet’s metadata as grains\n18:30 - Covering SaltStack’s Vocabulary: Grains and Pillars\n22:30 - Binding SaltStack to the private IPv4 address\n24:00 - Ed has a cool use-case for Tailscale, connecting his SaltStack nodes over disparate private networks\n26:30 - Connecting to our SaltStack master / Checking it works!\n28:00 - Approving our first minion key\n29:20 - Oops! Our provisioning on the CentOS machine failed. Lets fix it (Fuck you, Python 2)\n37:00 - Introduction to SaltStack CLI\n38:20 - Executing remote commands on minions\n39:00 - Targeting minions\n40:00 - Querying grains\n52:00 - Fixing the Ubuntu machine (Fuck you, Python 2)\n56:10 - SaltStack communication method. Spoiler: event driven through zero-mq\n58:40 - Python / wheel on Arm needs compiled, so it’s a bit slower.\n59:30 - Installing software to our minions through SaltStack’s package module\n1:07:00 - Looking at state modules\n1:09:00 - Writing our first state using the cron state module\n1:13:00 - Running a single state from the file root\n1:14:00 - Adding the file state module to our first state: creating a directory and writing a file\n1:26:45 - Provisioning all our machines with SSH keys from our custom grain data\n\n\n\U0001F481\U0001F3FB‍♂️    Want some help?\n\n\U0001F4AC  Leave a comment\n\U0001F426  Ping me on Twitter - https://twitter.com/rawkode\n\U0001F4C6  Schedule some time during my office-hours - https://rawko.de/office-hours\n\n\n\U0001F30E    Links\n\nEdward Vielmetti - https://twitter.com/w8emv\nSaltStack - https://saltstack.com\nPacket - https://packet.com"
publishedAt: 2020-09-17T17:00:00.000Z
technologies:
  - salt
show: rawkode-live
videoId: akvx71sbz8fsyk50yhcde4vz
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
---

