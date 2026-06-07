---
id: f85p38gkhu1pxtu1bnnixglq
slug: hands-on-with-rust-async-await
title: 'Hands-on with Rust: Async / Await'
description: >-
  Senyo Simpson joins David to dig into Rust's async/await. They cover lazy
  futures, the Tokio executor, spawn and join, then build a custom Future,
  executor, and Waker from scratch to show what happens under the hood.
whatYouWillLearn:
  - "Explore how Rust futures stay lazy until an executor polls them"
  - "Use Tokio spawn and join to run concurrent async tasks together"
  - "Build a custom future, waker, and executor that reschedules delayed work"
publishedAt: 2021-08-18T17:00:00.000Z
type: live
category: tutorial
technologies:
  - rust
show: rawkode-live
chapters:
  - startTime: 0
    title: Viewer Comments
  - startTime: 55
    title: Introductions
  - startTime: 58
    title: Introduction and Welcome
  - startTime: 98
    title: Guest Introduction (Samuel)
  - startTime: 129
    title: Samuel's Background and Interest in Rust
  - startTime: 345
    title: What is Asynchronous Programming?
  - startTime: 656
    title: Async/Await in Rust vs. Go
  - startTime: 740
    title: Starting the Code Demonstration
  - startTime: 770
    title: Spawning & Joining Futures
  - startTime: 810
    title: Setting up the Tokyo Executor
  - startTime: 955
    title: Understanding Lazy Futures & Await
  - startTime: 1203
    title: 'Demo: Synchronous vs. Asynchronous HTTP Requests'
  - startTime: 1681
    title: 'Using `tokio::spawn` for Concurrency'
  - startTime: 1819
    title: 'The Need for Waiting: `tokio::join!`'
  - startTime: 1951
    title: Recap of Async Basics & Tokyo
  - startTime: 2023
    title: Discussing Sharing Data (Send/Sync/Pin)
  - startTime: 2142
    title: 'Lazy Execution, Executors, and Wakers (Q&A)'
  - startTime: 2279
    title: Understanding Futures Internally
  - startTime: 2477
    title: 'Implementing a Custom Future (Poll::Pending)'
  - startTime: 2480
    title: Writing Our Own Futures
  - startTime: 2689
    title: The Role of Wakers
  - startTime: 2838
    title: 'Implementing a Custom Future (Poll::Ready)'
  - startTime: 2990
    title: Writing Our Own Executor
  - startTime: 3106
    title: 'Executor Structure: Task Queue & Channels'
  - startTime: 3390
    title: Executor `run` Method
  - startTime: 3614
    title: Implementing the Task Struct
  - startTime: 3724
    title: 'Pin, Box, Mutex: Why are they needed?'
  - startTime: 3928
    title: Implementing ArcWake for Rescheduling
  - startTime: 4295
    title: Creating a Future with Actual Delay (FutureDelay)
  - startTime: 4659
    title: Running the Custom Executor with a Delay Future
  - startTime: 4937
    title: Conclusion and Wrap-up
duration: 5063
guests:
  - senyosimpson
resources:
  - title: Tokio
    type: url
    url: 'https://tokio.rs/'
    category: documentation
  - title: reqwest HTTP client
    type: url
    url: 'https://docs.rs/reqwest/'
    category: documentation
  - title: Async Book (Rust)
    type: url
    url: 'https://rust-lang.github.io/async-book/'
    category: documentation
---
