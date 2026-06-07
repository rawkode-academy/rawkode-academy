---
id: knjh17mds1g14mv1smmzoqoq
slug: docker-kubernetes-and-php-laravel-edition-part-ii
title: 'Docker, Kubernetes, & PHP: Laravel Edition (Part II)'
description: >-
  Ciaran McNulty returns to refine the Laravel dev environment from Part I:
  tuning Docker for Mac volume performance, splitting Node.js asset compilation
  (Webpack, Laravel Mix, Tailwind) out of the PHP container, and tidying the
  Compose and Kubernetes manifests.
whatYouWillLearn:
  - "Configure a local Laravel stack with separate PHP, NGINX, and MariaDB containers for repeatable local development."
  - "Split Node.js asset compilation into its own container with shared volumes, so frontend changes recompile without PHP rebuilds."
  - "Tune Docker for Mac volume options, such as delegated and cached consistency flags, to speed file syncing."
publishedAt: 2020-09-23T17:00:00.000Z
type: live
category: tutorial
technologies:
  - docker
  - docker-compose
  - kubernetes
  - laravel
  - php
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 70
    title: Introductions
  - startTime: 110
    title: 'Context / Background: What are we going to do?'
  - startTime: 660
    title: Looking at the development environment we provided last time
  - startTime: 720
    title: Docker for Mac volume options for better performance
  - startTime: 1320
    title: >-
      Making asset / nodejs asset compilation a better experience for local
      development
duration: 5184
guests:
  - ciaranmcnulty
resources:
  - title: Ping CRM
    type: url
    url: 'https://github.com/inertiajs/pingcrm'
    category: demos
  - title: Laravel Mix documentation
    type: url
    url: 'https://laravel-mix.com/docs/6.0/installation'
    category: documentation
---
