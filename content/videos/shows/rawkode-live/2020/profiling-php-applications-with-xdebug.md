---
id: ilwszy3zkvzjrijebbn58eps
slug: profiling-php-applications-with-xdebug
title: Profiling PHP Applications with Xdebug
description: >-
  In this episode, joined by Derick Rethans, we take a look at Xdebug and how it
  help you profile your PHP applications, allowing you to use a profiling
  front-end, like qcachegrind, to visualise your call graphs and dig into the
  bottlenecks of your applications.
publishedAt: 2020-09-18T17:00:00.000Z
type: live
category: tutorial
technologies:
  - php
  - xdebug
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 115
    title: Introductions
  - startTime: 390
    title: What are we going to profile?
  - startTime: 690
    title: Installing and enabling Xdebug extension with Pecl
  - startTime: 1060
    title: Profiling our hello-world example
  - startTime: 1700
    title: Profiling our factorial example
  - startTime: 2780
    title: Profiling our simple composer configuration
  - startTime: 3450
    title: Profiling our complex composer configuration
  - startTime: 4140
    title: Compiling Xdebug 3 for the performance gains!
  - startTime: 4380
    title: Profiling our complex composer configuration with much gains
duration: 5372
guests:
  - derick-rethans
resources:
  - title: QCachegrind profiling viewer
    category: other
    evidence_quote: >-
      the way how I would view this is by using q cache client, or in my case, k
      cache client.
    confidence: high
  - title: KCachegrind profiling viewer
    category: other
    evidence_quote: >-
      the variant that I use is called k cache client, which is the same tool
      but with a slightly different looking from that.
    confidence: medium
  - title: Composer dependency manager
    category: other
    evidence_quote: >-
      we can actually profile composer itself before tackling something much
      larger.
    confidence: medium
  - title: Zulu CMS project
    category: code
    evidence_quote: >-
      Now that's just a project I found on GitHub called Zulu. It seems to be
      like a CMS system built on Laravel or Symphony.
    confidence: medium
---

