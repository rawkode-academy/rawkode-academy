---
id: introduction-to-crossplane
slug: introduction-to-crossplane
title: Introduction to Crossplane
description: "Crossplane, a Cloud Native Computing Foundation sandbox project, is an open source Kubernetes add-on that extends any cluster with the ability to provision and manage cloud infrastructure, services, and applications using kubectl, GitOps, or any tool that works with the Kubernetes API.\n\nWith Crossplane you can:\n\n- Provision & manage cloud infrastructure with kubectl\n  - Install Crossplane to provision and manage cloud infrastructure and services from any Kubernetes cluster.\n  - Provision infrastructure primitives from any provider (GCP, AWS, Azure, Alibaba, on-prem) and use them alongside existing application configurations.\n  - Version, manage, and deploy with your favorite tools and workflows that you’re using with your clusters today.\n\n- Publish custom infrastructure resources for your applications to use\n  - Define, compose, and publish your own infrastructure resources with declarative YAML, resulting in your own infrastructure CRDs being added to the Kubernetes API for applications to use.\n  - Hide infrastructure complexity and include policy guardrails, so applications can easily and safely consume the infrastructure they need, using any tool that works with the Kubernetes API.\n  - Consume infrastructure resources alongside any Kubernetes application to provision and manage the cloud services they need with Crossplane as an add-on to any Kubernetes cluster.\n\n- Deploy applications using a team-centric approach with OAM\n  - Define cloud native applications and the infrastructure they require with the Open Application Model (OAM).\n  - Collaborate with a team-centric approach with a strong separation of concerns:\n    - Infrastructure operators - provide infrastructure and services for applications to consume\n    - Application developers - build application components independent of infrastructure\n    - Application operators - compose, deploy, and run application configurations\n  - Deploy application configurations from app delivery pipelines or GitOps workflows, using the proven Kubernetes declarative model.\n\n\n\U0001F570 Timeline\n\n00:00 - Holding Screen\n01:20 - Introductions\n02:20 - What is Crossplane?\n09:40 - Does Crossplane compete or complement tools like Terraform and Pulumi?\n14:00 - Installing Crossplane\n20:00 - Installing the Equinix Metal provider\n32:00 - Deploying a Crossplane Configuration\n45:00 - Deploying a Device with a CRD\n51:00 - Provisioning the Device\n1:02:00 - Looking at the spec to deploy Tinkerbell\n1:07:00 - What is Equinix / Equinix Fabric?\n\n\n\n\U0001F30E Resources\n\nDaniel Mangum - https://twitter.com/stefanprodan\nMarques Johansson - https://twitter.com/displague\nCrossplane - https://crossplane.io/\nEquinix Metal Crossplane Provider - https://github.com/packethost/crossplane-provider-equinix-metal\nEquinix Fabric - https://metal.equinix.com/developers/docs/networking/fabric"
publishedAt: 2020-10-14T17:00:00.000Z
technologies:
  - crossplane
show: rawkode-live
videoId: gh80b8535py01j2wjsqlc12z
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 80
    title: Introductions
  - startTime: 83
    title: Introduction
  - startTime: 139
    title: What is Crossplane? (Core Concepts & Comparison)
  - startTime: 140
    title: What is Crossplane?
  - startTime: 323
    title: 'Benefits of Crossplane (GitOps, Policy)'
  - startTime: 580
    title: Does Crossplane compete or complement tools like Terraform and Pulumi?
  - startTime: 586
    title: Crossplane vs. Traditional IaC Tools
  - startTime: 840
    title: Installing Crossplane
  - startTime: 842
    title: 'Getting Started: Installation Prerequisites'
  - startTime: 940
    title: Installing Crossplane Core Components
  - startTime: 1120
    title: Installing the Crossplane CLI
  - startTime: 1184
    title: Installing a Provider (Equinix Metal Example)
  - startTime: 1200
    title: Installing the Equinix Metal provider
  - startTime: 1631
    title: Provider Authentication (Credentials)
  - startTime: 1918
    title: Introduction to Compositions (Advanced Mode)
  - startTime: 1920
    title: Deploying a Crossplane Configuration
  - startTime: 2297
    title: 'Deep Dive: Composite Resource Definitions (XRDs) and Compositions'
  - startTime: 2692
    title: Deploying an Abstract Resource Instance
  - startTime: 2700
    title: Deploying a Device with a CRD
  - startTime: 3060
    title: Provisioning the Device
  - startTime: 3102
    title: Customizing Deployed Resources & Immutability (User Data)
  - startTime: 3545
    title: Extending Crossplane with Other Providers & Advanced Use Cases
  - startTime: 3720
    title: Looking at the spec to deploy Tinkerbell
  - startTime: 3911
    title: Provider SSH & Future Provider Features
  - startTime: 4020
    title: What is Equinix / Equinix Fabric?
  - startTime: 4031
    title: Equinix Fabric Integration Potential
  - startTime: 4481
    title: Contributing to Crossplane & Community Resources
  - startTime: 4598
    title: Conclusion and Future Plans
duration: 4725
---

