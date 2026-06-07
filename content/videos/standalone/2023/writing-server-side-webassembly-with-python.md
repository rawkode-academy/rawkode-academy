---
id: p795mbb7u556q13aap1d4m1j
slug: writing-server-side-webassembly-with-python
title: Writing Server Side WebAssembly with Python
description: >-
  Walk through Fermyon's Spin Python SDK: installing the py2wasm plugin,
  returning JSON, parsing headers, body, and query strings, and making outbound
  HTTP requests, with tips for navigating the Rust source while LSP support is
  pending.
whatYouWillLearn:
  - "Install the py2wasm plugin and Spin Python template before generating a project."
  - "Return JSON, then read request headers, body, and query parameters from Spin."
  - "Make outbound HTTP requests, then allow only approved hosts in Spin config."
publishedAt: 2023-03-29T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - spin
chapters:
  - startTime: 0
    title: Introduction & Python SDK Overview
  - startTime: 10
    title: Installing the Spin Python SDK
  - startTime: 34
    title: 'Generated Project Structure (Pipfile, app.py, spin.toml)'
  - startTime: 84
    title: Building and Running the Default App
  - startTime: 113
    title: Common Spin SDK Tasks Overview
  - startTime: 171
    title: Modifying the HTTP Response (Returning JSON)
  - startTime: 242
    title: Accessing Request Headers (LSP Note & Rust Code)
  - startTime: 481
    title: Accessing the Request Body
  - startTime: 565
    title: Accessing Query Parameters
  - startTime: 691
    title: Making Outbound HTTP Requests
  - startTime: 783
    title: Configuring Allowed HTTP Hosts
  - startTime: 858
    title: Conclusion & Future Improvements
duration: 899
guests: []
resources:
  - title: fermyon/spin-python-sdk
    type: url
    url: 'https://github.com/spinframework/spin-python-sdk'
    category: code
---
