---
id: d4p1so8omkjzyrpsgvyf5n6d
slug: buiding-a-webassembly-graphql-client
title: Buiding a WebAssembly GraphQL Client
description: >-
  In this episode, joined by Connor and Francis, we'll attempt to build a
  GraphQL client using WebAssembly, to hook into Connor's Suborbital project.
publishedAt: 2021-07-06T17:00:00.000Z
type: live
category: tutorial
technologies:
  - suborbital
  - webassembly
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 40
    title: Introductions
  - startTime: 48
    title: Introduction and Housekeeping
  - startTime: 91
    title: Guest Introductions
  - startTime: 194
    title: 'Project Goal: WebAssembly GraphQL Client'
  - startTime: 253
    title: WebAssembly Sandboxing and Challenges
  - startTime: 315
    title: WASI and Networking Capabilities
  - startTime: 420
    title: What is Suborbital?
  - startTime: 431
    title: 'Platform Overview (Suborbital: Reactor, Atmo)'
  - startTime: 564
    title: Shopify's Wasm Use Case (Scripts)
  - startTime: 690
    title: 'Starting the Implementation: Host Side (Go)'
  - startTime: 705
    title: Live Coding a GraphQL WebAssembly (WASM) Client
  - startTime: 710
    title: Three Layers of the Build
  - startTime: 769
    title: Understanding the GraphQL Request/Response Structure
  - startTime: 1036
    title: 'Host-Module Communication Mechanics (FFI, Memory)'
  - startTime: 1383
    title: 'Mid-Stream Q&A (TinyGo, Memory Access, Trust)'
  - startTime: 1779
    title: Designing Go GraphQL Client Data Structures
  - startTime: 2445
    title: Implementing the Go GraphQL Client Logic
  - startTime: 3780
    title: Handling GraphQL Errors in the Go Client
  - startTime: 4118
    title: Committing the Go Client Work
  - startTime: 4178
    title: Exposing the Go Client as a Host Capability
  - startTime: 4268
    title: Defining the Go Host Function Interface
  - startTime: 4368
    title: 'Discussion: Passing Complex Data (Variables, JSON)'
  - startTime: 4530
    title: Reading Data from Wasm Memory on the Host
  - startTime: 4660
    title: Calling the Go GraphQL Client from the Host Function
  - startTime: 4710
    title: Host Side Error Handling (Temporary Logging)
  - startTime: 4778
    title: Host Function Return Value (Size or Error Code)
  - startTime: 4840
    title: Writing the Response Back to Wasm Memory
  - startTime: 4918
    title: Creating the Go Host Function Wrapper
  - startTime: 4991
    title: 'Q&A: Wasm Use Cases & Garbage Collection'
  - startTime: 5278
    title: Switching to the Wasm Module Side (Rust)
  - startTime: 5295
    title: Defining the Host Function Import in Rust
  - startTime: 5330
    title: Creating the User-Facing Rust Function
  - startTime: 5415
    title: Preparing Data for the Host Call in Rust
  - startTime: 5545
    title: Calling the Go Host Function from Rust
  - startTime: 5742
    title: Reading the Response from Wasm Memory in Rust
  - startTime: 5790
    title: Setting up the Rust Wasm Test Module
  - startTime: 5900
    title: Implementing the Rust Module Logic
  - startTime: 6098
    title: Debugging and Compilation Issues
  - startTime: 6831
    title: Successful Wasm Module Compilation
  - startTime: 6958
    title: Running the Rust Wasm Module
  - startTime: 6986
    title: Demonstration of Successful Execution
  - startTime: 7034
    title: Summary and Concluding Thoughts
  - startTime: 7157
    title: Final Remarks and Sign Off
duration: 7204
guests:
  - connor-hicks
  - francis-gulotta
resources:
  - title: api.rawkode.dev GraphQL endpoint
    url: 'https://api.rawkode.dev'
    category: demos
    evidence_quote: And it would go and hit API dot Rawkode.dev.
    confidence: high
  - title: Shopify Scripts platform
    category: other
    evidence_quote: 'So we have this project, this this app called Scripts.'
    confidence: medium
  - title: Rawkode.chat Discord
    url: 'https://rawkode.chat'
    category: other
    evidence_quote: there is a Discord channel available at Rawkode.chat.
    confidence: high
---

