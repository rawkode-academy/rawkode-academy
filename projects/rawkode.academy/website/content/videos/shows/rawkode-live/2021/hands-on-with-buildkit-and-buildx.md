---
id: hands-on-with-buildkit-and-buildx
slug: hands-on-with-buildkit-and-buildx
title: Hands-on with BuildKit & buildx
description: "In this episode, we take a look at the multi-platform super caching BuildKit and buildx\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n00:50 - Introductions\n10:00 - Building a Go Project with Docker\n27:00 - Build caching with mounts\n43:00 - Local Outputs\n51:00 - Multi Platform Builds\n1:04:00 - Bake with HCL\n1:12:00 - Cross-compilation with native toolchains\n\n\U0001F465 About the Guests\n\nTõnis Tiigi\n\n  .\n\n\n\U0001F426 https://twitter.com/tonistiigi\n\U0001F9E9 https://github.com/tonistiigi\n\n\n\n\U0001F528 About the Technologies\n\nDocker\n\nDocker is a set of platform as a service (PaaS) products that use OS-level virtualization to deliver software in packages called containers. Containers are isolated from one another and bundle their own software, libraries and configuration files; they can communicate with each other through well-defined channels. Because all of the containers share the services of a single operating system kernel, they use fewer resources than virtual machines.\nThe service has both free and premium tiers. The software that hosts the containers is called Docker Engine. It was first started in 2013 and is developed by Docker, Inc.\n\n\U0001F30F https://docker.com\n\U0001F426 https://twitter.com/docker\n\U0001F9E9 https://github.com/docker\n\n#Docker #Containers"
publishedAt: 2021-08-25T17:00:00.000Z
technologies:
  - buildkit
  - docker
show: rawkode-live
videoId: zybh1hw8655u5i7j6njntv59
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 50
    title: Introductions
  - startTime: 53
    title: Introduction & Housekeeping
  - startTime: 102
    title: 'Meet the Guest: Thomas Tighe'
  - startTime: 231
    title: 'BuildKit vs Buildx: What are they?'
  - startTime: 440
    title: BuildKit Community Adoption
  - startTime: 542
    title: 'Hands-on: Improving a Go Dockerfile'
  - startTime: 600
    title: Building a Go Project with Docker
  - startTime: 948
    title: First Build with `docker buildx build`
  - startTime: 1060
    title: 'Exploring `docker buildx` Commands (`inspect`, `ls`)'
  - startTime: 1341
    title: Comparing Build Speeds (Old vs New Dockerfile)
  - startTime: 1406
    title: Optimizing Dependency Caching (`go mod download`)
  - startTime: 1620
    title: Build caching with mounts
  - startTime: 1687
    title: Optimizing Compiler Cache (`--mount=type=cache`)
  - startTime: 2160
    title: Using `--mount=type=bind` for Source Code
  - startTime: 2216
    title: Build Context Upload Optimizations
  - startTime: 2552
    title: 'Q&A: Dockerignore with BuildKit'
  - startTime: 2580
    title: Local Outputs
  - startTime: 2611
    title: Exporting Binaries Locally (`--output=type=local`)
  - startTime: 2816
    title: Exporting Specific Binaries with a Scratch Stage
  - startTime: 2997
    title: Ensuring Static Binaries (`CGO_ENABLED=0`)
  - startTime: 3060
    title: Multi Platform Builds
  - startTime: 3068
    title: Introduction to Multi-Platform Builds
  - startTime: 3119
    title: Building Multiple Platforms with the `--platform` Flag (Issue Explained)
  - startTime: 3300
    title: Buildx Drivers (Container Driver)
  - startTime: 3379
    title: Creating a Buildx Builder Instance (`docker buildx create`)
  - startTime: 3479
    title: Multi-Platform Build with Container Driver (QEMU)
  - startTime: 3721
    title: QEMU Emulation Performance & Installation
  - startTime: 3840
    title: Bake with HCL
  - startTime: 3878
    title: Docker Buildx Bake (Declarative Builds)
  - startTime: 4091
    title: 'Demo: Using a Docker Bake File (`docker-bake.hcl`)'
  - startTime: 4320
    title: Cross-compilation with native toolchains
  - startTime: 4348
    title: Cross Compilation using Dockerfiles (`FROM --platform=build`)
  - startTime: 4648
    title: 'Demo: Cross Compilation for Multi-Platform'
  - startTime: 4741
    title: Cross Compilation Caching Explained
  - startTime: 4948
    title: Building for Different Architectures (Darwin Example)
  - startTime: 5071
    title: Using the "local" Platform in Bake Files
  - startTime: 5139
    title: Advanced Cross Compilation (XX Project)
  - startTime: 5257
    title: Q&A and Conclusion
duration: 5436
---

