---
id: ncgxuu1vyx5yl7psezcz79dk
slug: supply-chain-security-with-a-cli-valint
title: 'Supply Chain Security with a CLI: valint'
description: >-
  Valint is a powerful tool that validates the integrity of your supply chain,
  providing organizations with a way to enforce policies using the Scribe
  Service, CI, or admission controller.
publishedAt: 2023-05-22T17:00:00.000Z
type: recorded
category: tutorial
technologies: []
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 39
    title: What is Valint and Why Use It?
  - startTime: 81
    title: Getting Started with Valint
  - startTime: 125
    title: Evidence Collection Capabilities
  - startTime: 185
    title: Generating a Container Image BOM
  - startTime: 247
    title: Attesting Evidence with Sigstore
  - startTime: 317
    title: Verifying Evidence and Policies
  - startTime: 363
    title: Understanding Environment Context
  - startTime: 446
    title: Policy Enforcement Explained
  - startTime: 508
    title: 'Policy Demo: Breaking and Failing a Check'
  - startTime: 557
    title: Detailed Look at Collected Evidence
  - startTime: 631
    title: Storing Evidence in OCI Artifacts
  - startTime: 742
    title: Scanning a Git Repository
  - startTime: 793
    title: Examining the Software Bill of Materials
  - startTime: 852
    title: Conclusion
duration: 884
guests: []
resources:
  - title: Valint Installation Script
    url: 'https://get.scrapesecurity.com/install.sh'
    category: code
    evidence_quote: >-
      You can grab it from get.scrapesecurity.com/install.sh, where if you put
      that through a shell, you will get your Valant in your local directory.
    confidence: high
  - title: Scribe Security JFrog Container Registry
    category: other
    evidence_quote: >-
      Or you can pull the Valiant container image from their JFrog instance,
      which is scrapesecurity.jfrog.i0/scrape-docker-public-local/valiant
      latest.
    confidence: high
  - title: Indigo (Blue Sky Go SDK)
    category: code
    evidence_quote: >-
      I'm in a directory and taking a look at Blue Sky Go SDK or program called
      Indigo.
    confidence: high
  - title: Mongo Express
    category: code
    evidence_quote: we'll scan a git repository. Mongoexpressmongoexpress.git.
    confidence: high
  - title: Sigstore
    url: 'https://sigstore.dev'
    category: other
    evidence_quote: this will ask me to log in with Segstor.
    confidence: medium
---

