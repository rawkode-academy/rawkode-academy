---
id: diok2rek56nt6nq7z3839qei
slug: secure-container-images-the-easy-way
title: Secure Container Images The EASY Way
description: >-
  Slim Toolkit probes a running container with HTTP or exec probes to learn
  which files the workload actually uses, then rebuilds a minimal image. Demos
  shrink NGINX from 33MB to 12MB, a Rust dog image from 97MB to under 10MB, and
  an unoptimised Astro build from 1.4GB to 100MB.
whatYouWillLearn:
  - "Use HTTP probes to discover runtime files inside a container image."
  - "Drive Slim Toolkit with exec probes for command-line applications."
  - "Shrink unoptimized Astro and NGINX images without breaking functionality."
publishedAt: 2023-04-25T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - slim-toolkit
chapters:
  - startTime: 0
    title: Introduction and the Problem
  - startTime: 28
    title: Introducing Slim Toolkit
  - startTime: 44
    title: 'Demo: Slimming NGINX (HTTP Probe)'
  - startTime: 147
    title: 'Demo: Slimming a Rust CLI (dog)'
  - startTime: 316
    title: 'Demo: Slimming a Website (Unoptimized)'
  - startTime: 551
    title: 'Conclusion: Benefits of Slim Toolkit'
duration: 580
guests: []
resources:
  - title: dog DNS lookup project
    type: url
    url: 'https://github.com/ogham/dog'
    category: code
  - title: Astro Dockerfile documentation
    type: url
    url: 'https://docs.astro.build/en/recipes/docker/'
    category: documentation
  - title: Rawkode Academy website
    type: url
    url: 'https://rawkode.academy'
    category: demos
---
