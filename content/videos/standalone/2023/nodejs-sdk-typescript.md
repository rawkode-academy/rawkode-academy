---
id: krr31oe2upl14q4rc7qufyls
slug: nodejs-sdk-typescript
title: NodeJS SDK (TypeScript)
description: >-
  A walkthrough of Fermyon Spin's Node.js SDK in TypeScript: handling request
  headers, ArrayBuffer bodies, JSON parsing with Zod for runtime safety, query
  strings via qs, outbound fetch, and configuring allowed_outbound_hosts.
whatYouWillLearn:
  - "Handle request headers by reading x-name, uppercasing it, and echoing it back."
  - "Parse JSON request bodies with Zod so runtime validation matches the TypeScript shape."
  - "Use qs to split query strings from the path, then allow outbound hosts."
publishedAt: 2023-02-02T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - spin
chapters:
  - startTime: 0
    title: Introduction to the Node.js SDK
  - startTime: 80
    title: Getting Started with Code and Setup
  - startTime: 98
    title: Understanding Spin SDK Types (Request/Response)
  - startTime: 169
    title: Building and Running the Basic Application
  - startTime: 208
    title: Handling Request Headers
  - startTime: 404
    title: Handling Request Body (Accessing ArrayBuffer)
  - startTime: 485
    title: Converting Body to String
  - startTime: 548
    title: Handling JSON Request Body
  - startTime: 638
    title: Runtime Type Safety with Zod
  - startTime: 782
    title: Handling Query Strings with `qs`
  - startTime: 923
    title: Outbound HTTP Requests (Using Fetch API)
  - startTime: 991
    title: Configuring Allowed Outbound Hosts in spin.toml
  - startTime: 1072
    title: Conclusion and Summary
duration: 1103
guests: []
resources:
  - type: url
    title: Spin JavaScript/TypeScript components
    category: documentation
    url: 'https://spinframework.dev/v3/javascript-components'
  - type: url
    title: Spin outbound HTTP
    category: documentation
    url: 'https://spinframework.dev/v3/http-outbound'
  - type: url
    title: Zod
    category: documentation
    url: 'https://zod.dev/'
  - type: url
    title: qs query string parser
    category: code
    url: 'https://github.com/ljharb/qs'
---
