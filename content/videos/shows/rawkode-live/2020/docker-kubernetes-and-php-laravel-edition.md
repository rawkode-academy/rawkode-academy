---
id: kpfeh5ghghzqkarckn9sxme0
slug: docker-kubernetes-and-php-laravel-edition
title: 'Docker, Kubernetes, and PHP: Laravel Edition'
description: >-
  In this episode, joined by Ciaran McNulty, we' take a look at the best
  practices for developing Laravel PHP applications with Docker, Docker Compose,
  and Kubernetes.
publishedAt: 2020-09-16T17:00:00.000Z
type: live
category: tutorial
technologies:
  - docker
  - kubernetes
  - laravel
  - php
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 90
    title: Introductions
  - startTime: 270
    title: Looking at Flarum
  - startTime: 600
    title: Switching to pingcrm (Thanks @bowersbros)
  - startTime: 840
    title: How specific should I be with container images?
  - startTime: 1020
    title: Adding MariaDB to `docker-compose.yml`
  - startTime: 1170
    title: Adding nginx and fpm to `docker-compose.yml`
  - startTime: 1440
    title: Dependencies and health-checks for `docker-compose.yml`
  - startTime: 1980
    title: Fighting with `.env`
  - startTime: 3360
    title: Interactive development with a the Docker shell pattern (dshell)
  - startTime: 3720
    title: Add a multi-layer `Dockerfile`
  - startTime: 3840
    title: Adding PHP extensions to the container image
  - startTime: 4260
    title: Adding a `Makefile` to codify commands
  - startTime: 4900
    title: Fighting with nginx
  - startTime: 6000
    title: Deploying to Kubernetes
duration: 9800
guests:
  - ciaran-mcnulty
resources:
  - title: Inertia Ping CRM
    category: code
    evidence_quote: >-
      Alex has suggested we take a look at anterior patent CRM. So we're gonna
      do a last minute switch.
    confidence: medium
  - title: rawcode/php-examples
    url: 'https://gitlab.com/rawcode/php-examples'
    category: code
    evidence_quote: It's available on gitlab.com/rawcode/php-examples.
    confidence: high
  - title: Refactoring Databases
    category: other
    evidence_quote: Does it have you read the refactoring databases?
    confidence: high
  - title: The Twelve-Factor App manifesto
    category: documentation
    evidence_quote: this is classic 12 factor manifesto stuff.
    confidence: medium
---

