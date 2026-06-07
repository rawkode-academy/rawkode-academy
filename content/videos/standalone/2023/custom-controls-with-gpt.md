---
id: wsxnftsmvohcoqr4izm8mur6
slug: custom-controls-with-gpt
title: Custom Controls with GPT
description: >-
  Armo Platform's ChatGPT integration turns plain-English prompts into Rego for
  Kubescape custom controls. We build a "no latest tag" rule, then a
  CAP_SYS_ADMIN deny, debug the generated policy in the Rego Playground, and run
  it with `kubescape scan control --use-from`.
whatYouWillLearn:
  - "Generate a no latest tag policy for Kubernetes workloads from plain English."
  - "Debug AI-generated Rego in the playground when the deny rule does not fire."
  - "Patch the downloaded control path so CAP_SYS_ADMIN checks reach container specs."
publishedAt: 2023-03-30T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - kubescape
  - opa
chapters:
  - startTime: 0
    title: 'Introduction: ChatGPT, Kubescape, and the Rego Challenge'
  - startTime: 102
    title: Introducing Armo Platform and AI Custom Controls
  - startTime: 153
    title: 'Creating a Simple Control: No Latest Tag'
  - startTime: 196
    title: Examining the AI-Generated Rego Policy
  - startTime: 252
    title: Running the Custom Control with Kubescape CLI
  - startTime: 311
    title: 'Creating a More Complex Control: Deny CAP_SYS_ADMIN'
  - startTime: 360
    title: Debugging with the Rego Playground
  - startTime: 437
    title: Correcting the Generated Rego Policy Path
  - startTime: 489
    title: Modifying the Downloaded Control File
  - startTime: 536
    title: Conclusion and Summary
duration: 581
guests: []
resources:
  - title: Armo Platform
    type: url
    url: 'https://www.armosec.io/'
    category: other
  - title: Rego Playground
    type: url
    url: 'https://play.openpolicyagent.org/'
    category: demos
  - title: Open Policy Agent
    type: url
    url: 'https://www.openpolicyagent.org/'
    category: documentation
---
