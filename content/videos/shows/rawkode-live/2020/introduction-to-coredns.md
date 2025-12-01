---
id: introduction-to-coredns
slug: introduction-to-coredns
title: Introduction to CoreDNS
description: "CoreDNS is a DNS server. It is written in Go.\n\nCoreDNS is different from other DNS servers, such as (all excellent) BIND, Knot, PowerDNS and Unbound (technically a resolver, but still worth a mention), because it is very flexible, and almost all functionality is outsourced into plugins.\n\nPlugins can be stand-alone or work together to perform a “DNS function”.\n\nSo what’s a “DNS function”? For the purpose of CoreDNS, we define it as a piece of software that implements the CoreDNS Plugin API. The functionality implemented can wildly deviate. There are plugins that don’t themselves create a response, such as metrics or cache, but that add functionality. Then there are plugins that do generate a response. These can also do anything: There are plugins that communicate with Kubernetes to provide service discovery, plugins that read data from a file or a database.\n\nThere are currently about 30 plugins included in the default CoreDNS install, but there are also a whole bunch of external plugins that you can compile into CoreDNS to extend its functionality.\n\nCoreDNS is powered by plugins.\n\nWriting new plugins should be easy enough, but requires knowing Go and having some insight into how DNS works. CoreDNS abstracts away a lot of DNS details, so that you can just focus on writing the plugin functionality you need.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:20 - Introductions\n03:22 - Why do we need new DNS software?\n05:10 - Is DNS still evolving?\n08:45 - What is CoreDNS?\n16:00 - Demo: Supporting multiple protocols\n20:50 - UDP or DNS over HTTPS?\n22:40 - Demo: Multiple Zones\n26:00 - Debugging DNS\n30:00 - Demo: dnstap\n37:45 - Building a plugin\n42:00 - CoreDNS's DNS configuration\n47:00 - Future roadmap\n48:30 - Questions\n\n\n\U0001F30E Resources\n\nMiek Gieben - https://twitter.com/miekg\nGopher - LEGO - DNS - creator of CoreDNS\n\nCoreDNS - https://coredns.io"
publishedAt: 2020-11-05T17:00:00.000Z
technologies:
  - coredns
show: rawkode-live
videoId: c46r2bn411wdonadyion4cxd
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 80
    title: Introductions
  - startTime: 138
    title: Guest Introduction and CoreDNS Overview
  - startTime: 200
    title: Why a New DNS Server? (CoreDNS Origins)
  - startTime: 202
    title: Why do we need new DNS software?
  - startTime: 306
    title: Evolution of the DNS Protocol
  - startTime: 310
    title: Is DNS still evolving?
  - startTime: 427
    title: The Origins of CoreDNS (Inspired by Caddy)
  - startTime: 520
    title: Introduction to CoreDNS Concepts (Slides Begin)
  - startTime: 525
    title: What is CoreDNS?
  - startTime: 571
    title: CoreDNS Plugin System
  - startTime: 659
    title: Plugin Ordering Explained
  - startTime: 717
    title: Corefile Configuration Examples
  - startTime: 960
    title: 'Demo: Supporting multiple protocols'
  - startTime: 965
    title: Debugging CoreDNS
  - startTime: 1055
    title: 'Demo: Basic Queries (DNS and DoH)'
  - startTime: 1250
    title: UDP or DNS over HTTPS?
  - startTime: 1358
    title: Multiple Servers in Corefile
  - startTime: 1360
    title: 'Demo: Multiple Zones'
  - startTime: 1420
    title: 'Demo: Logging with Multiple Servers'
  - startTime: 1560
    title: Debugging DNS
  - startTime: 1567
    title: 'Debugging Plugins (pprof, trace, dnstap)'
  - startTime: 1727
    title: Introduction to Dnstap
  - startTime: 1793
    title: 'Demo: Using Dnstap for Debugging'
  - startTime: 1800
    title: 'Demo: dnstap'
  - startTime: 2265
    title: Building a plugin
  - startTime: 2270
    title: Understanding CoreDNS Plugins (Code Example)
  - startTime: 2520
    title: CoreDNS's DNS configuration
  - startTime: 2522
    title: 'Real World Use Case: CoreDNS.io Hosting'
  - startTime: 2640
    title: Automated DNSSEC and Zone Transfer Explained (Using Logs)
  - startTime: 2820
    title: Future roadmap
  - startTime: 2905
    title: Questions and Discussion
  - startTime: 2910
    title: Questions
  - startTime: 3529
    title: Conclusion and Wrap-up
duration: 3590
---

