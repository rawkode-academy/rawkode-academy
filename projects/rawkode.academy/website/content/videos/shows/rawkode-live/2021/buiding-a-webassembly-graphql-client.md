---
id: buiding-a-webassembly-graphql-client
slug: buiding-a-webassembly-graphql-client
title: Buiding a WebAssembly GraphQL Client
description: "In this episode, joined by Connor and Francis, we'll attempt to build a GraphQL client using WebAssembly, to hook into Connor's Suborbital project.\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding Screen\n00:40 - Introductions\n07:00 - What is Suborbital?\n11:45 - Live Coding a GraphQL WebAssembly (WASM) Client\n\n\U0001F465 About the Guests\n\nConnor Hicks\n\n  Connor Hicks is a software developer based in Ottawa, Canada. Connor works on security and distributed systems projects, leading Product Discovery at 1Password as well as building the Suborbital open source project. Connor is a strong believer in building security and privacy into the core of all software, and is exploring the next generation of web service development with technologies like WebAssembly.\n\n\n\U0001F426 https://twitter.com/cohix\n\U0001F9E9 https://github.com/cohix\n\n\n\nFrancis Gulotta\n\n  Francis Gulotta has spent many years writing JavaScript and making it fun to run in strange places. Like robots in classrooms, or underwater sensor drones causing international incidents or amazon lambda. Making projects is hard, and he hopes he has made it a little bit easier for the developers to get building. He's the maintainer of Node SerialPort and a handful of other niche open source projects. Currently Francis is at Shopify helping build a WASM powered platform so we can expose previously impossible APIs to our app developers.\n\n\n\U0001F426 https://twitter.com/reconbot\n\U0001F9E9 https://github.com/reconbot\n\n\n\n\U0001F528 About the Technologies\n\nSuborbital\n\nThe Suborbital Development Platform is a family of open source tools and frameworks that help you build web services that are powerful, but never complicated.\n\n\U0001F30F https://suborbital.dev\n\U0001F426 https://twitter.com/SuborbitalDev\n\U0001F9E9 https://github.com/suborbital\n\n#WebAssembly #WASM #FaaS #Serverless\n\n\nWebAssembly\n\nWebAssembly (abbreviated Wasm) is a binary instruction format for a stack-based virtual machine. Wasm is designed as a portable compilation target for programming languages, enabling deployment on the web for client and server applications.\n\n\U0001F30F https://webassembly.org/\n\n\U0001F9E9 https://github.com/WebAssembly\n\n#WebAssembly #WASM\n\n\nGraphQ\n\nGraphQL is a query language for APIs and a runtime for fulfilling those queries with your existing data. GraphQL provides a complete and understandable description of the data in your API, gives clients the power to ask for exactly what they need and nothing more, makes it easier to evolve APIs over time, and enables powerful developer\_tools.\n\n\U0001F30F https://graphql.org/\n\U0001F426 https://twitter.com/graphql\n\U0001F9E9 https://github.com/graphql\n\n#GraphQL"
publishedAt: 2021-07-06T17:00:00.000Z
technologies:
  - suborbital
show: rawkode-live
videoId: d4p1so8omkjzyrpsgvyf5n6d
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
---

