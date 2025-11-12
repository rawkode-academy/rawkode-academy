---
id: introduction-to-opentelemetry
slug: introduction-to-opentelemetry
title: Introduction to OpenTelemetry
description: "Special Guests: Amy Tobey (https://twitter.com/MissAmyTobey)\n and Liz Fong-Jones (https://twitter.com/lizthegrey)\n\nAmy has worked in web operations for more than 20 years at companies of every size, touching everything from kernel code to user interfaces. When she's not working she can usually be found around her home in San Jose, caring for her family, making music, or doing yoga in the sun.\n\nLiz is a developer advocate, labor and ethics organizer, and Site Reliability Engineer (SRE) with 16+ years of experience. She is an advocate at Honeycomb for the SRE and Observability communities, and previously was an SRE working on products ranging from the Google Cloud Load Balancer to Google Flights.\n\nOpenTelemetry is an observability framework - software and tools that assist in generating and capturing telemetry data from cloud-native software.\n\nWhat is an Observability Framework?\n\nOpenTelemetry provides the libraries, agents, and other components that you need to capture telemetry from your services so that you can better observe, manage, and debug them. Specifically, OpenTelemetry captures metrics, distributed traces, resource metadata, and logs (logging support is incubating now) from your backend and client applications and then sends this data to backends like Prometheus, Jaeger, Zipkin, and others for processing. OpenTelemetry is composed of the following:\n\n- One API and SDK per language, which include the interfaces and implementations that define and create distributed traces and metrics, manage sampling and context propagation, etc.\n- Language-specific integrations for popular web frameworks, storage clients, RPC libraries, etc. that (when enabled) automatically capture relevant traces and metrics and handle context propagation\n- Automatic instrumentation agents that can collect telemetry from some applications without requiring code changes\n- Language-specific exporters that allow SDKs to send captured traces and metrics to any supported backends\n- The OpenTelemetry Collector, which can collect data from OpenTelemetry SDKs and other sources, and then export this telemetry to any supported backend\n\nOpenTelemetry is a CNCF Sandbox member, formed through a merger of the OpenTracing and OpenCensus projects.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n02:30 - What is OpenTelemetry?\n04:50 - What was setup in advance\n07:30 - Looking at an OpenTelemetry example\n11:30 - Adding the gRPC interceptors\n16:20 - Adding the OpenTelemetry initialisation code and stdout exporter\n24:45 - Triggering our first trace\n26:10 - Adding the Honeycomb exporter\n41:30 - Adding additional context to our traces\n59:40 - Adding extra spans / instrumenting database calls\n\n\n\U0001F30E Resources\n\nAmy Tobey - https://twitter.com/MissAmyTobey\nLiz Fong-Jones - https://twitter.com/lizthegrey\nOpenTelemetry - https://opentelemetery.io\nHoneycomb - https://honeycomb.io\nTinkerbell - https://tinkerbell.org"
publishedAt: 2020-11-03T17:00:00.000Z
technologies:
  - opentelemetry
show: rawkode-live
videoId: qsajojlbooovvzl4r05aabx8
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 59
    title: Introduction and Guests
  - startTime: 60
    title: Introductions
  - startTime: 146
    title: What is OpenTelemetry and Why Use It?
  - startTime: 150
    title: What is OpenTelemetry?
  - startTime: 290
    title: What was setup in advance
  - startTime: 300
    title: 'Setting the Stage: Tinkerbell Project & Setup'
  - startTime: 450
    title: Looking at an OpenTelemetry example
  - startTime: 456
    title: Exploring OpenTelemetry Go Example
  - startTime: 690
    title: Adding the gRPC interceptors
  - startTime: 701
    title: Implementing gRPC Instrumentation
  - startTime: 955
    title: Debugging Initial Instrumentation
  - startTime: 980
    title: Adding the OpenTelemetry initialisation code and stdout exporter
  - startTime: 1458
    title: Verifying Basic Instrumentation
  - startTime: 1485
    title: Triggering our first trace
  - startTime: 1569
    title: Configuring Honeycomb Exporter
  - startTime: 1570
    title: Adding the Honeycomb exporter
  - startTime: 2051
    title: Debugging Exporter Setup
  - startTime: 2343
    title: Viewing Traces in Honeycomb
  - startTime: 2490
    title: Adding additional context to our traces
  - startTime: 2492
    title: Adding Custom Attributes (Manual Instrumentation)
  - startTime: 3182
    title: Debugging Attribute Visibility
  - startTime: 3540
    title: Further Debugging Build Issues
  - startTime: 3580
    title: Adding extra spans / instrumenting database calls
  - startTime: 4605
    title: Verifying Custom Attributes and Spans
  - startTime: 5110
    title: Conclusion and Q&A
duration: 5212
---

