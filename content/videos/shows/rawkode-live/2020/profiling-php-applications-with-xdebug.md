---
id: ilwszy3zkvzjrijebbn58eps
slug: profiling-php-applications-with-xdebug
title: Profiling PHP Applications with Xdebug
description: >-
  Derick Rethans walks through installing Xdebug via PECL, enabling its
  profiler, and reading the resulting Cachegrind files in QCachegrind to find
  hot paths, starting from hello-world and factorial scripts before profiling
  Composer install on a real project.
whatYouWillLearn:
  - "Install and enable Xdebug with PECL, confirm extension loading, then generate profiler output from the PHP CLI."
  - "Capture traces hello-world and factorial scripts, then inspect Cachegrind call trees in QCachegrind to find hot spots."
  - "Profile Composer install in xdebug versions 2 and 3, then compare output and isolate Composer-specific profiling settings."
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
  - derickr
resources:
  - title: KCachegrind profiling viewer
    type: url
    url: 'https://kcachegrind.github.io/'
    category: other
  - title: QCachegrind profiling viewer
    type: url
    category: other
  - title: Composer dependency manager
    type: url
    url: 'https://getcomposer.org/'
    category: other
  - title: Zulu CMS project
    type: url
    category: code
---
