---
id: ierbuewtemudd1i0w0wru28j
slug: bluesky-embed-with-spin-webassembly
title: BlueSky Embed with Spin WebAssembly
description: >-
  Build a Bluesky post embed with Spin and WebAssembly. We wire up a Lit web
  component to a TypeScript Spin backend, handle CORS, cache auth tokens in the
  key-value store, call createSession and getPostThread, and use the KV
  Explorer to seed credentials on deploy.
publishedAt: 2023-06-23T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - spin
  - webassembly
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 12
    title: 'Project Goal: Blue Sky Embed'
  - startTime: 42
    title: Live Demonstration
  - startTime: 85
    title: Frontend Web Component Explained
  - startTime: 137
    title: Spin Backend Structure (TypeScript)
  - startTime: 167
    title: Handling CORS Requests
  - startTime: 205
    title: Using Key-Value Store for Auth
  - startTime: 237
    title: Blue Sky Authentication Flow
  - startTime: 251
    title: Fetching Blue Sky Post Details
  - startTime: 369
    title: Managing Key-Value Data
  - startTime: 393
    title: Introducing the KV Explorer Tool
  - startTime: 412
    title: KV Explorer Live Demo
  - startTime: 478
    title: Setting Initial KV Data During Deploy
  - startTime: 523
    title: Summary and Next Steps
duration: 560
guests: []
resources:
  - title: Bluesky API create session endpoint
    type: url
    url: 'https://docs.bsky.app/docs/api/com-atproto-server-create-session'
    category: documentation
  - title: Bluesky API getPostThread XRPC endpoint
    type: url
    url: 'https://docs.bsky.app/docs/api/app-bsky-feed-get-post-thread'
    category: documentation
  - title: Fermyon KV Explorer component
    type: url
    url: 'https://github.com/fermyon/spin-kv-explorer'
    category: code
---

