---
id: v0i31x8ecolt41m670pt9cto
slug: global-dns-with-bgp
title: Global DNS with BGP
description: >-
  Checkout https://rawkode.academy/metal and use the code "rawkode" for 200USD
  in FREE Equinix Metal credits.
publishedAt: 2022-08-11T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - coredns
  - pulumi
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 117
    title: Introduction and Course Overview
  - startTime: 181
    title: 'Today''s Goal: Global DNS Architecture with BGP'
  - startTime: 225
    title: Equinix Metal Credits & Resources
  - startTime: 275
    title: Course Repository and Materials
  - startTime: 280
    title: Course Overview
  - startTime: 349
    title: 'Beginning Manual Setup: Provisioning Devices'
  - startTime: 515
    title: Automation
  - startTime: 700
    title: Requesting a Global IP
  - startTime: 716
    title: Reserving a Global IP Address (Manual)
  - startTime: 803
    title: 'Configuring BGP Manually: Introducing BERT'
  - startTime: 1010
    title: Configuring Interface
  - startTime: 1117
    title: Using the Equinix Metadata Service
  - startTime: 1178
    title: Enabling BGP
  - startTime: 1193
    title: Enabling BGP in the Equinix Console
  - startTime: 1276
    title: Configuring Network Interfaces and Routes for BGP
  - startTime: 1359
    title: Installing and Configuring BERT with Network Helpers
  - startTime: 1411
    title: Verifying BERT Status (BGP Established)
  - startTime: 1467
    title: Installing CoreDNS Manually
  - startTime: 1648
    title: Configuring BGP
  - startTime: 1656
    title: Configuring CoreDNS (Zone & Core File)
  - startTime: 1768
    title: Core DNS Configuration
  - startTime: 1817
    title: Setting up CoreDNS Systemd Service
  - startTime: 1818
    title: Testing Core DNS
  - startTime: 1849
    title: Debugging Manual CoreDNS Startup Issues
  - startTime: 1968
    title: Core DNS Plugins
  - startTime: 2080
    title: Testing Manual CoreDNS Resolution (Dig)
  - startTime: 2083
    title: Testing Google
  - startTime: 2116
    title: Testing Manual Setup via BGP IP & Traceroute
  - startTime: 2198
    title: Transition to Automation Overview
  - startTime: 2248
    title: How BGP works
  - startTime: 2393
    title: Pulumi Automation Status & Rerun
  - startTime: 2433
    title: Polymel program
  - startTime: 2435
    title: Explaining the Pulumi/Q Program
  - startTime: 2473
    title: Queue
  - startTime: 2506
    title: Reviewing Cloud Config Scripts
  - startTime: 2528
    title: JQ
  - startTime: 2558
    title: Bird
  - startTime: 2607
    title: Reviewing Pulumi Device Definition (Q)
  - startTime: 2608
    title: Global IP
  - startTime: 2653
    title: Define resources
  - startTime: 2727
    title: Debugging Automated Device Configuration
  - startTime: 2779
    title: Applying Fixes to Automated Devices
  - startTime: 3108
    title: Core DNS
  - startTime: 3205
    title: Confirming Automated Setup is Working
  - startTime: 3263
    title: Testing Automated DNS via BGP & Traceroute
  - startTime: 3394
    title: Session Wrap-up and Summary
  - startTime: 3444
    title: 'Preview of Next Session: Functions at the Edge'
  - startTime: 3509
    title: Conclusion and Outro
duration: 3555
guests: []
resources:
  - title: Rawkode Academy Courses
    url: 'https://github.com/rawkode-academy/courses'
    category: code
    evidence_quote: >-
      There is a repository there called courses. You will find the global reach
      BGP directory here. This is today's session with the README and some
      Pulumi automation
    confidence: high
  - title: Equinix Metal
    url: 'https://rawkode.link/metal'
    category: other
    evidence_quote: >-
      If you wanna work along and do this on your own, there's a link below,
      rawkode.linkmetal. This will take you to the Equinix Medal homepage
    confidence: high
  - title: PacketHost Network Helpers
    url: 'https://github.com/packethost/network-helpers'
    category: code
    evidence_quote: >-
      The network helpers available at github.com/packethost/network-helpers do
      everything for you. They speak to the metadata API to pull out all the
      peer information to configure BERT.
    confidence: high
  - title: CoreDNS Plugins Documentation
    category: documentation
    evidence_quote: >-
      So if you come here to core dns. Go to plugins. Well, we got here, we've
      got ACLs... there's a cache one here.
    confidence: high
  - title: BIRD Internet Routing Daemon
    category: other
    evidence_quote: >-
      BERT is a BGP advertiser. BERT BGP. Here. So it's just open source
      software that anyone can use.
    confidence: medium
---

