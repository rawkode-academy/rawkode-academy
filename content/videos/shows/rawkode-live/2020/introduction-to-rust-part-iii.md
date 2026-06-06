---
id: mz4qbj0rv0214w4idf272hhw
slug: introduction-to-rust-part-iii
title: Introduction to Rust (Part III)
description: >-
  Jane Lusby walks David through writing a CLI anagram finder in Rust, covering
  cargo project setup, editions, lifetimes, generics with impl Into and where
  clauses, command-line parsing with structopt, and reading the system
  dictionary with BufReader and iterators.
publishedAt: 2020-12-11T17:00:00.000Z
type: live
category: tutorial
technologies:
  - rust
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 66
    title: Introduction & Guest
  - startTime: 261
    title: Episode Plan
  - startTime: 298
    title: 'Hello World: Project Setup & Basic Output (Cargo new, lib/main)'
  - startTime: 300
    title: Creating our first Rust application
  - startTime: 476
    title: Understanding Rust Editions
  - startTime: 480
    title: Explaining Rust editions
  - startTime: 510
    title: Creating our first Rust application
  - startTime: 556
    title: 'Main Function, Tests, and Basic Return Types'
  - startTime: 821
    title: Adding Parameters & Initial Testing
  - startTime: 945
    title: Lifetime elision
  - startTime: 981
    title: 'Understanding Lifetimes (`''static`, `''a`)'
  - startTime: 1140
    title: Generic types and functions with Impl Into Option
  - startTime: 1194
    title: >-
      Handling Optional Inputs & Exploring Generics Syntax (`impl Into`, `<T:
      Trait>`, `where`)
  - startTime: 1664
    title: Rust's Lack of Function Overloading Discussion
  - startTime: 2020
    title: 'Program inputs with std::env'
  - startTime: 2028
    title: 'Getting Command Line Arguments (`std::env::args`)'
  - startTime: 2160
    title: Lifetimes
  - startTime: 2460
    title: Writing an anagram finder
  - startTime: 2474
    title: Anagram Finder Project Setup (Cargo new)
  - startTime: 2537
    title: Defining Anagram Function Signature & Initial Tests
  - startTime: 3118
    title: 'Dependency Management: crates.io & cargo-edit'
  - startTime: 3170
    title: Pulling dependencies from Crates.io
  - startTime: 3300
    title: Looking at Structopt
  - startTime: 3301
    title: Command Line Parsing with structopt (Demo using Hello World logic)
  - startTime: 3875
    title: 'File I/O: Loading the Dictionary (`BufReader`, `lines()`)'
  - startTime: 3900
    title: Loading a file with BufReader
  - startTime: 4120
    title: Handling File Open Results (`if let`)
  - startTime: 4476
    title: Converting Iterator to Collection (`collect()`)
  - startTime: 4520
    title: Collect
  - startTime: 4566
    title: 'Anagram Logic: Iterators, Filtering & Sorting'
  - startTime: 4620
    title: 'Iterators, Filters, and Map'
  - startTime: 5228
    title: Iterator vs IntoIterator Distinction
  - startTime: 5352
    title: Testing & Debugging Anagram Finder Logic
  - startTime: 5430
    title: 'Helpful Resource: cheats.rs (Language Sugar)'
  - startTime: 5537
    title: Conclusion
duration: 5615
guests:
  - yaahc
resources:
  - title: Awesome Rust Mentors Project
    type: url
    url: 'https://github.com/RustBeginners/awesome-rust-mentors'
    category: code
  - title: StructOpt crate
    type: url
    url: 'https://github.com/TeXitoi/structopt'
    category: code
  - title: Cargo Edit
    type: url
    url: 'https://github.com/killercup/cargo-edit'
    category: code
  - title: std.rs BufReader documentation
    type: url
    url: 'https://doc.rust-lang.org/std/io/struct.BufReader.html'
    category: documentation
  - title: cheats.rs Rust cheat sheet
    type: url
    url: 'https://cheats.rs/'
    category: documentation
---

