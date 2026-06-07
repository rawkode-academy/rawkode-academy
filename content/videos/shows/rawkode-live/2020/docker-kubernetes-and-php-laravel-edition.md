---
id: kpfeh5ghghzqkarckn9sxme0
slug: docker-kubernetes-and-php-laravel-edition
title: 'Docker, Kubernetes, and PHP: Laravel Edition'
description: >-
  Ciaran McNulty joins David to containerize the Ping CRM Laravel app from
  scratch: building a docker-compose stack with PHP-FPM, Nginx and MariaDB,
  layering a Dockerfile with PHP extensions, then deploying to Kubernetes.
whatYouWillLearn:
  - "Containerize a Laravel application with docker-compose using PHP-FPM, Nginx, and MariaDB."
  - "Build a multi-layer Dockerfile workflow that handles PHP dependencies, extensions, and environment files."
  - "Deploy the resulting app image to Kubernetes while considering migration strategies and rollout behavior."
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
  - ciaranmcnulty
resources:
  - title: Inertia Ping CRM
    type: url
    url: 'https://github.com/inertiajs/pingcrm'
    category: code
  - title: rawcode/php-examples
    type: url
    url: 'https://gitlab.com/rawcode/php-examples'
    category: code
  - title: Refactoring Databases
    type: url
    url: 'https://databaserefactoring.com/'
    category: other
  - title: The Twelve-Factor App manifesto
    type: url
    url: 'https://12factor.net/'
    category: documentation
---
