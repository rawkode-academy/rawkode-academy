---
id: qsajojlbooovvzl4r05aabx8
slug: introduction-to-opentelemetry
title: Introduction to OpenTelemetry
description: >-
  Amy Tobey and Liz Fong-Jones join David to instrument a Go gRPC service
  (Tinkerbell) with OpenTelemetry from scratch, wiring up the SDK, a stdout
  exporter, a Honeycomb exporter, custom attributes, and database spans.
publishedAt: 2020-11-03T17:00:00.000Z
type: live
category: tutorial
technologies:
  - opentelemetry
  - grpc
  - tinkerbell
show: rawkode-live
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
guests:
  - amy-tobey
  - liz-fong-jones
resources:
  - title: OpenTelemetry Go contrib gRPC instrumentation example
    type: url
    url: 'https://github.com/open-telemetry/opentelemetry-go-contrib'
    category: code
  - title: OpenTelemetry Go trace API documentation
    type: url
    url: 'https://pkg.go.dev/go.opentelemetry.io/otel/trace'
    category: documentation
---

