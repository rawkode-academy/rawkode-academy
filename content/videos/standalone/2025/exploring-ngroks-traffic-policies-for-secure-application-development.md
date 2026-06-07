---
id: ovgas80n8hqlkknowpijiqbb
slug: exploring-ngroks-traffic-policies-for-secure-application-development
title: Exploring ngrok's Traffic Policies for Secure Application Development
description: >-
  Using ngrok Traffic Policies and CEL expressions to lock down a Deno API:
  restrict the /metrics endpoint to specific IPs, then geo-restrict /uk to
  United Kingdom visitors with a custom CEL-interpolated 404 response.
whatYouWillLearn:
  - "Restrict Prometheus metrics with ngrok traffic policies by matching the /metrics path."
  - "Use CEL geo variables to block or allow requests by country."
  - "Return a custom 404 response with CEL-interpolated country text for /uk."
publishedAt: 2025-01-20T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - ngrok
chapters:
  - startTime: 0
    title: Introduction & What We'll Cover
  - startTime: 26
    title: The Demo Application
  - startTime: 109
    title: Basic ngrok Setup
  - startTime: 111
    title: Exposing the App with ngrok
  - startTime: 152
    title: Testing the Basic ngrok Tunnel
  - startTime: 212
    title: Introducing ngrok Traffic Policies
  - startTime: 254
    title: Applying the First Traffic Policy (Global IP Restriction)
  - startTime: 279
    title: Testing Global IP Restriction
  - startTime: 294
    title: Understanding the Policy File (Initial IP Restriction)
  - startTime: 338
    title: Using Common Expression Language (CEL)
  - startTime: 352
    title: Exploring ngrok Documentation & CEL Variables
  - startTime: 437
    title: Applying IP Restriction to /metrics
  - startTime: 440
    title: 'Policy: Restricting IP by Path (/metrics)'
  - startTime: 461
    title: Testing Path-Based IP Restriction
  - startTime: 469
    title: Demonstrating Path-Specific IP Restriction
  - startTime: 508
    title: 'Policy: Implementing Geo-Restriction Setup (/uk endpoint)'
  - startTime: 526
    title: Exploring Geo Variables in Documentation
  - startTime: 562
    title: Initial Geo-Restriction Policy Attempt (Deny by Country)
  - startTime: 625
    title: Testing Initial Geo-Restriction (Debugging Required)
  - startTime: 658
    title: Debugging and Refining Geo-Restriction Logic
  - startTime: 660
    title: 'Refining Geo Policy: Add Path Scope (/uk)'
  - startTime: 677
    title: Using Custom Responses Action
  - startTime: 690
    title: Configuring Custom Response with CEL Interpolation
  - startTime: 750
    title: Testing Corrected Geo-Restriction Policy
  - startTime: 751
    title: Demonstrating Corrected Geolocation Restriction (/uk)
  - startTime: 821
    title: Overview of Other Policy Features
  - startTime: 854
    title: Conclusion & Call to Action
duration: 866
guests: []
resources:
  - title: ngrok Documentation
    type: url
    url: 'https://ngrok.com/docs'
    category: documentation
  - title: ngrok Traffic Policy
    type: url
    category: documentation
  - title: Common Expression Language (CEL)
    type: url
    category: documentation
  - title: Traffic Policy Connection Variables
    type: url
    category: documentation
  - title: Traffic Policy HTTP Request Variables
    type: url
    category: documentation
  - title: Traffic Policy Geo Variables
    type: url
    category: documentation
  - title: Restrict IPs Action
    type: url
    category: documentation
  - title: Deny Action
    type: url
    category: documentation
  - title: Custom Response Action
    type: url
    category: documentation
---
