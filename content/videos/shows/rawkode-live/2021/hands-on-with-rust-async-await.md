---
id: hands-on-with-rust-async-await
slug: hands-on-with-rust-async-await
title: 'Hands-on with Rust: Async / Await'
description: "In this episode, Senyo and I will gets hands-on with Rust's async/await features.\n#RustTutorial\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Viewer Comments\n00:55 - Introductions\n12:50 - Spawning & Joining Futures\n41:20 - Writing Our Own Futures\n49:50 - Writing Our Own Executor\n\n\U0001F465 About the Guests\n\nSenyo Simpson\n\n  Passionate about building technological infrastructure that enables others to build great products \U0001F331\n\n\n\U0001F426 https://twitter.com/SenYeezus\n\U0001F9E9 https://github.com/senyosimpson\n\U0001F30F https://senyosimpson.com/\n\n\n\U0001F528 About the Technologies\n\nRust\n\nRust is a multi-paradigm programming language designed for performance and safety, especially safe concurrency. Rust is syntactically similar to C++, but can guarantee memory safety by using a borrow checker to validate references. Rust achieves memory safety without garbage collection, and reference counting is optional.\nRust was originally designed by Graydon Hoare at Mozilla Research, with contributions from Dave Herman, Brendan Eich, and others. The designers refined the language while writing the Servo layout or browser engine, and the Rust compiler.\n It has gained increasing use in industry, and Microsoft has been \nexperimenting with the language for secure and safety-critical software \ncomponents.\nRust has been voted the \"most loved programming language\" in the Stack Overflow Developer Survey every year since 2016.\n\n\U0001F30F https://www.rust-lang.org/\n\U0001F426 https://twitter.com/rustlang\n\U0001F9E9 https://github.com/rust-lang/rust\n\n#RustLang"
publishedAt: 2021-08-18T17:00:00.000Z
technologies:
  - rust
show: rawkode-live
videoId: f85p38gkhu1pxtu1bnnixglq
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
---

