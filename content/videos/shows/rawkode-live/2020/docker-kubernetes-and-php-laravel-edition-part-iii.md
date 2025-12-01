---
id: docker-kubernetes-and-php-laravel-edition-part-iii
slug: docker-kubernetes-and-php-laravel-edition-part-iii
title: 'Docker, Kubernetes, & PHP: Laravel Edition (Part III)'
description: "In this episode, joined by Ciaran McNulty & Alex Bowers, we take a look at the best practices for developing Laravel PHP applications with Docker, Docker Compose, and Kubernetes.\n\nOur focus is on PHP applications run with nginx and php-fpm. This episode is a follow up to my \"Kickass Development Environments with Docker\" talk that I gave from 2016-2018.\n\nDubbed \"The PHP Framework for Web Artisan\", Laravel is a web application framework with expressive, elegant syntax. We’ve already laid the foundation — freeing you to create without sweating the small things.\n\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:35 - Introductions\n03:00 - Context - What have we done thus far?\n05:50 - Automating the npm watcher\n12:00 - Automating database migrations\n18:00 - Confirming live reload works\n22:10 - Getting hot module reload working\n58:00 - Adding database persistence\n1:03:00 - Running the tests\n1:05:10 - Optimising our Dockerfile layers and caching\n\n\U0001F481\U0001F3FB‍♂️    Want some help?\n\n\U0001F4AC  Leave a comment\n\U0001F426  Ping me on Twitter - https://twitter.com/rawkode\n\U0001F4C6  Schedule some time during my office-hours - https://rawko.de/office-hours\n\n\n\U0001F30E    Links\n\nCiaran McNulty - https://twitter.com/CiaranMcNulty\nAlex Bowers - https://twitter.com/bowersbros\nCode from Tutorial - https://gitlab.com/rawkode/php-examples"
publishedAt: 2020-10-06T17:00:00.000Z
technologies:
  - docker
  - kubernetes
  - laravel
  - php
show: rawkode-live
videoId: dbs5yf9vg0tg7k73uo0gfivh
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 94
    title: Introduction & Series Context
  - startTime: 95
    title: Introductions
  - startTime: 180
    title: Context - What have we done thus far?
  - startTime: 194
    title: Recap of Current Docker Development Setup
  - startTime: 240
    title: 'Identifying Initial Problems (Missing Assets, NPM Not Running)'
  - startTime: 300
    title: Debugging Node/Asset Workflow from Previous Episode
  - startTime: 350
    title: Automating the npm watcher
  - startTime: 351
    title: Fixing Node Container Dependency in Docker Compose
  - startTime: 468
    title: Troubleshooting NPM Run (Cross-env not found)
  - startTime: 502
    title: Realizing NPM Install is Required
  - startTime: 526
    title: Automating NPM Install & Watch via Make Target
  - startTime: 608
    title: Successful Basic Development Environment (Assets Compiling)
  - startTime: 720
    title: Automating database migrations
  - startTime: 728
    title: 'Application Loads, Identifying Missing Migrations'
  - startTime: 743
    title: Running Database Migrations & Seeding with Artisan
  - startTime: 766
    title: Discussing Development Workflow and D Shell Usage
  - startTime: 1077
    title: Application Fully Functional After Migrations
  - startTime: 1080
    title: Confirming live reload works
  - startTime: 1090
    title: Testing Live Reloading of Assets
  - startTime: 1228
    title: Live Reloading Appears to Work (Initial Check)
  - startTime: 1245
    title: 'Discussion: Rolling Up Migrations (Laravel 8)'
  - startTime: 1271
    title: 'Discussion: Using SQL Dumps for DB Init'
  - startTime: 1330
    title: Getting hot module reload working
  - startTime: 1331
    title: Addressing Hot Module Reloading (HMR)
  - startTime: 1397
    title: Switching to NPM Run Hot for HMR
  - startTime: 1493
    title: Debugging HMR - Not Working as Expected
  - startTime: 1580
    title: Identifying HMR Server Port Conflict
  - startTime: 1664
    title: Adjusting Docker Compose Ports for HMR
  - startTime: 1695
    title: Restarting Services & Re-running NPM Install
  - startTime: 1888
    title: Further HMR Debugging (Console Errors)
  - startTime: 1899
    title: Reverting to NPM Run Watch for Comparison
  - startTime: 1987
    title: NPM Run Watch Works - Examining Mix Manifest and Hot File
  - startTime: 2518
    title: Realizing Hot File Needs to be Accessible to PHP Container
  - startTime: 2614
    title: Manually Creating Hot File in PHP Container
  - startTime: 2678
    title: Debugging HMR Requests (Port 8080)
  - startTime: 2754
    title: Fixing NPM Run Hot Binding Address (Localhost vs 0.0.0.0)
  - startTime: 2837
    title: Re-testing HMR After Binding Fix
  - startTime: 3480
    title: Adding database persistence
  - startTime: 3560
    title: Successful Hot Module Reloading
  - startTime: 3580
    title: 'Viewer Q&A: DB Persistence & Series Navigation'
  - startTime: 3721
    title: >-
      Assessing "Completeness" of Local Development Setup (Missing Scheduler,
      Queues, Advanced Tests)
  - startTime: 3780
    title: Running the tests
  - startTime: 3785
    title: Deciding on Future Episodes with a More Complex Application
  - startTime: 3799
    title: 'Current Goals for Ping CRM: Run Tests, Deploy to Kubernetes'
  - startTime: 3807
    title: Running Unit Tests (Make Test)
  - startTime: 3909
    title: Reviewing Production Dockerfile (Multi-stage Build)
  - startTime: 3910
    title: Optimising our Dockerfile layers and caching
  - startTime: 3961
    title: Running Tests Within the Dockerfile Build
  - startTime: 4008
    title: Fixing Production Dockerfile Composer Steps
  - startTime: 4111
    title: 'Viewer Q&A: Docker BuildKit Parallelism'
  - startTime: 4247
    title: Refactoring Dockerfile Composer Steps for Caching
  - startTime: 4466
    title: Testing Refactored Dockerfile Build & Caching
  - startTime: 4611
    title: 'Discussion: Composer Lock Files (.lock) in Container Workflows'
  - startTime: 4741
    title: Troubleshooting Dockerfile Composer Scripts Issue
  - startTime: 4801
    title: Using --no-scripts for Composer Install
  - startTime: 4886
    title: Using Composer 2 Image
  - startTime: 5052
    title: Production Docker Image Build Successful (with Caching)
  - startTime: 5366
    title: 'Discussion: Docker Build Secrets (SSH/Private Repos)'
  - startTime: 5461
    title: >-
      Wrap-up: Ping CRM Setup Complete (for basics), Next Steps with New App &
      Kubernetes
  - startTime: 5498
    title: Conclusion
duration: 5535
---

