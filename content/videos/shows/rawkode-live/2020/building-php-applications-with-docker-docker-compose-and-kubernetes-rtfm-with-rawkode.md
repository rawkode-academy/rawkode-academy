---
id: ni90hh70rr77srzpo199bbfv
slug: >-
  building-php-applications-with-docker-docker-compose-and-kubernetes-rtfm-with-rawkode
title: >-
  Building PHP Applications with Docker, Docker Compose, and Kubernetes (RTFM
  with Rawkode)
description: >-
  Ciaran McNulty joins to containerise a Slim Framework PHP app: NGINX and
  PHP-FPM as separate containers, Compose 2.x for health-check dependencies, a
  multi-stage Dockerfile, then Kubernetes with NGINX as a sidecar and
  independently scaled via a service.
whatYouWillLearn:
  - "Set up a Slim PHP app with separate NGINX and php-fpm containers driven from a shared codebase."
  - "Build a Compose 2.x workflow with service health checks, dependency ordering, and cached composer installs."
  - "Deploy the same Dockerized stack to Kubernetes using sidecar NGINX containers and independent service scaling."
publishedAt: 2020-09-09T17:00:00.000Z
type: live
category: tutorial
technologies:
  - docker
  - docker-compose
  - kubernetes
  - php
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 570
    title: Creating a Slim Framework application
  - startTime: 890
    title: 'Checking out the docker-compose.yml ... oh, did I write this?'
  - startTime: 1815
    title: Adding a damn .editorconfig
  - startTime: 1875
    title: Replacing the PHP dev server with nginx and php-fpm
  - startTime: 3300
    title: >-
      Ditching compose 3.x for 2.x: leveraging complex dependencies with
      health-checks
  - startTime: 4260
    title: Adding a multi-layer Dockerfile for build cache goodness
  - startTime: 5340
    title: Deploying our application to Kubernetes
duration: 6270
guests:
  - ciaranmcnulty
resources:
  - title: rawkode/php-examples
    type: url
    url: 'https://gitlab.com/rawkode/php-examples'
    category: code
  - title: Kick Ass Development Environments with Docker
    type: url
    category: other
  - title: Kustomize documentation
    type: url
    url: 'https://kustomize.io/'
    category: documentation
---
