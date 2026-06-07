---
id: bwo73aoo2k6ae9lrukcj6onr
slug: integrating-spin-with-static-site-generators-ssgs
title: Integrating Spin with Static Site Generators (SSGs)
description: >-
  Builds a multi-component Spin app, a JavaScript backend that calls OpenAI to
  detect languages plus a static frontend, then swaps the vanilla HTML for an
  Astro build to show how any SSG that produces a dist directory can be served
  by Spin's static file server.
whatYouWillLearn:
  - "Build a multi-component Spin app with a JavaScript backend and static frontend."
  - "Serve any static site generator output from Spin's static file server."
  - "Point Spin at an Astro dist directory and relaunch the app."
publishedAt: 2023-06-07T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - spin
  - webassembly
chapters:
  - startTime: 0
    title: Introduction and Project Overview
  - startTime: 24
    title: Application Structure with Spin
  - startTime: 118
    title: Initial Spin Application Configuration
  - startTime: 127
    title: 'Backend Component: JavaScript & OpenAI'
  - startTime: 236
    title: 'Frontend Component: Static Files'
  - startTime: 309
    title: 'Demo: Initial Application'
  - startTime: 359
    title: Backend Code Walkthrough
  - startTime: 513
    title: Integrating Astro SSG
  - startTime: 514
    title: Setting up Astro Project
  - startTime: 549
    title: Building Astro and Updating Spin Config
  - startTime: 576
    title: 'Demo: Spin Serving Astro'
  - startTime: 586
    title: Customizing Astro Content
  - startTime: 635
    title: Rebuilding and Demoing Updated Astro
  - startTime: 673
    title: Integrating Form into Astro Site
  - startTime: 703
    title: Final Application Demo
  - startTime: 715
    title: Conclusion
duration: 754
guests: []
resources:
  - title: Spin file server repository
    type: url
    url: 'https://github.com/spinframework/spin-fileserver'
    category: code
  - title: Astro website creation CLI
    type: url
    url: 'https://docs.astro.build/en/install-and-setup/'
    category: documentation
---
