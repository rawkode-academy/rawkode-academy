---
id: server-side-webassembly-at-the-edge
slug: server-side-webassembly-at-the-edge
title: Server Side WebAssembly at the Edge
description: >-
  In this video, I'll show you how to get started with the Fermyon Platform. A
  Collection of Open Source components that allows you to run your own
  server-side WASM binaries on Equinix Metal with low-latency routing, using
  BGP.
publishedAt: 2023-03-07T17:00:00.000Z
technologies:
  - spin
videoId: pg8dyt42vac1gmldqsjnkswg
chapters:
  - startTime: 61
    title: Introduction and Episode Goal
  - startTime: 118
    title: Why Equinix Metal? (BGP)
  - startTime: 168
    title: Equinix Metal Prerequisites & Setup
  - startTime: 275
    title: Running Terraform Init and Apply
  - startTime: 312
    title: Starting Terraform Apply and Code Walkthrough
  - startTime: 324
    title: Terraform Code Explanation (BGP Setup)
  - startTime: 634
    title: Modifying Nomad Jobs (Patching)
  - startTime: 745
    title: Retrieving Platform Access (Hepco)
  - startTime: 833
    title: Accessing Hepco UI (Initial Attempt)
  - startTime: 867
    title: Debugging the Deployment (SSH & Logs)
  - startTime: 924
    title: Identifying Cloud-Init Loop (BGP Metadata Issue)
  - startTime: 1048
    title: Destroying and Redeploying Infrastructure
  - startTime: 1094
    title: Correcting Project ID and Reapplying
  - startTime: 1166
    title: Waiting for Redeployment & Plan
  - startTime: 1309
    title: Redeployment Complete (Dallas)
  - startTime: 1348
    title: Accessing Hepco UI (Success)
  - startTime: 1371
    title: Deploying a Spin Application (CLI)
  - startTime: 1383
    title: Spin Login to Fermion Platform
  - startTime: 1502
    title: Spin Deploy Attempt (HTTP/HTTPS Issue)
  - startTime: 1573
    title: Debugging Spin Deploy Failure (Curl & Patch)
  - startTime: 1663
    title: 'SSH Debugging: Patch Failure Confirmed (Dallas)'
  - startTime: 1730
    title: Manual Patching of Nomad Job (Dallas)
  - startTime: 1860
    title: Executing Manual Nomad Job Update (Dallas)
  - startTime: 1872
    title: Testing Bundle URL Again (Still 404)
  - startTime: 1938
    title: Spin Deploy Success (After Manual Fixes)
  - startTime: 1992
    title: Testing Deployed Application (BGP Address)
  - startTime: 1996
    title: Benchmarking Latency Attempts (Drill & MTR)
  - startTime: 2192
    title: Measuring Initial Latency (Dallas)
  - startTime: 2337
    title: Confirming BGP Address Access via Browser
  - startTime: 2365
    title: Adding Second Metro (Amsterdam)
  - startTime: 2371
    title: Applying Terraform with Second Metro
  - startTime: 2454
    title: Waiting for Amsterdam Instance & BGP
  - startTime: 2467
    title: Demonstrating BGP Routing (Dallas vs Amsterdam)
  - startTime: 2474
    title: Deploying App to Amsterdam Instance
  - startTime: 2494
    title: Spin Login Attempt (Amsterdam IP)
  - startTime: 2592
    title: Spin Deploy Attempt (Amsterdam IP)
  - startTime: 2666
    title: Debugging Amsterdam Patch Failure
  - startTime: 2686
    title: Manual Patching of Amsterdam Nomad Job
  - startTime: 2750
    title: Amsterdam Bundle Job Updated
  - startTime: 2765
    title: Spin Deploy Success (Amsterdam)
  - startTime: 2787
    title: Testing Latency Again (Both Metros)
  - startTime: 2860
    title: Latency Reduction Demonstrated (Amsterdam)
  - startTime: 2890
    title: Summary and Conclusion
  - startTime: 2983
    title: Acknowledging Demo Issues & Call for Questions
  - startTime: 3014
    title: Responding to Chat & Final Remarks
  - startTime: 3043
    title: End
duration: 3073
---

