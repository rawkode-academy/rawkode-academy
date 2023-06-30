---
title: Terraform CDK with Python
theme: seriph
background: https://images.unsplash.com/photo-1531152127291-ea24c3b2a1da?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1740&q=80
highlighter: shiki
lineNumbers: true
info: |
    Terraform CDK with Python
drawings:
  persist: false
layout: cover
class: text-center
transition: slide-left
---

# Terraform CDK with Python

## Hello, Glasgow.

---

# Who Am I?

## David Flanagan

- Founder Rawkode Academy
- Formerly Pulumi, Equinix Metal (Packet), InfluxDB, & more.

<hr/>

- <carbon-logo-twitter /> rawkode
- <carbon-logo-github /> rawkode
- <carbon-logo-youtube /> @RawkodeAcademy
- <carbon-logo-discord /> https://rawkode.chat

---
layout: section
transition: slide-up
---

# Set the Scene ...

---
transition: slide-up
---

# ClickOps

What is ClickOps?

ClickOps is the process of managing and provisioning Things\<T\> through a Graphical User Interface (GUI).

- AWS Console
- Cloudflare Dashboard
- Beekeeper Studio

---

# ClickOps

Challenges

- Not repeatable
- **Humans are fallible**
- History / flavour / context is lost

---
transition: slide-up
---

# Infrastructure as Code (IaC)

What is IaC?

Infrastructure as Code (IaC) is the process of managing and provisioning Things\<T\> through code, or code like, definitions.

Typically commands consume these definitions and perform a "reconciliation" to ensure the state of the Things\<T\> matches the definitions.

When the real world doesn't reflect the definition, this is called "Drift"

---
transition: slide-up
---

# Infrastructure as Code (IaC)

Advantages

- Repeatable
- Machines are less fallible
- Current state and history stored in version control
- Knowledge sharing through pull requests

---
transition: slide-up
---

# Infrastructure as Code (IaC)

🧓🏻 1993 -> Present

## Innovation

Declarative DSLs, Dependency Graph, & Configuration Management

## Tools

- CFEngine
- Chef, Puppet, Ansible
- SaltStack
- Troposphere

---
transition: slide-up
---

# Infrastructure as Code (IaC)

👦🏻 2006 -> Present

## Innovation

<p><span style="color: var(--tertiary)">Infrastructure</span> as Code</p>

## Tools

- AWS CloudFormation
- Azure Bicept
- Google Cloud Deployment Manager
- Terraform

---

# Infrastructure as Code (IaC)

👶🏻 2018 -> Present

## Innovation

<p>Infrastructure as <span style="color: var(--tertiary)">Software</span></p>

## Tools

- Pulumi
- AWS & Terraform CDKs

---
transition: slide-up
---

# 🐘 in the 🧹

Before I continue ...

I used to work for Pulumi ... why am I talking about Terraform CDK?

<hr/>

1. Terraform is ubiquitous, mature, and well adopted
2. Using code as an intermediatory is actually a good thing
   1. Easier to stick to declarative
3. Pulumi relies on Terraform providers (atm)
   1. You can actually use CDK Constructs within Pulumi

---
transition: slide-up
---

# Language Support

Powered by JSII

- Python
- TypeScript / JavaScript
- Go
- Java
- More in the future?
  - Hoping for Rust

---

# TypeScript by Default

You can actually convert, with JSII, TypeScript constructs to any supported language.

So there's a lot of value in writing shared components this way, unless you're an exclusively Python shop.

---
transition: slide-up
---

# AWS Vs. Terraform CDK

## AWS CDK

- AWS only
- Renders CloudFormation
- CloudFormation for Execution

---
transition: slide-up
---

# AWS Vs. Terraform CDK

## Terraform CDK

- Use any Terraform provider
- Renders Terraform JSON
- Terraform for Execution

---

# Demo

### ⌨️ Wish me luck!

---

# Thoughts

Hopefully I showed: get, synth, plan, deploy, destroy

- Terraform CDK is a fantastic interface to Terraform
- You can still use Terraform CLI
- JIT providers is a nice touch over precompiled
- Testing isn't great
  - But really, there's better tools:
    - CUE
    - Rego
- L1/L2/L3 constructs & the Construct Hub have potential to be powerful
- Interopt with cdk8s 🤯

---

# Thanks

Until next time

## Any Questions?

- <carbon-logo-twitter /> rawkode
- <carbon-logo-github /> rawkode
- <carbon-logo-youtube /> @RawkodeAcademy
- <carbon-logo-discord /> https://rawkode.chat
