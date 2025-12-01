---
id: introduction-to-litmus-chaos
slug: introduction-to-litmus-chaos
title: Introduction to Litmus Chaos
description: "In this episode, we'll be guided through everything we need to know to get started with Litmus Chaos.\n\n\n\U0001F37F Rawkode Live\n\nHosted by David McKay / \U0001F426 https://twitter.com/rawkode\nWebsite: https://rawkode.live\nDiscord Chat: https://rawkode.live/chat\n\n#RawkodeLive\n\n\U0001F570 Timeline\n\n00:00 - Holding Screen\n00:30 - Introductions\n04:30 - What is Chaos Engineering & Litmus?\n19:00 - Questions\n28:45 - Demo Overview\n30:00 - Installing Litmus\n35:25 - Litmus Dashboard / UI / Hubs\n38:30 - Deploying our First Experiment\n54:35 - Kafka Chaos Experiment\n1:16:00 - Questions\n1:23:20 - Failing Chaos Demo\n\n\U0001F465 About the Guests\n\nUmasankar Mukkara\n\nUma is passionate about promoting and innovating Chaos Engineering. He is a maintainer on LitmusChaos CNCF project and leads Chaos Native as its CEO.\n\n\U0001F426 https://twitter.com/uma_mukkara\n\U0001F9E9 https://github.com/umamukkara\n\n\n\nKarthik Satchitanand\n\nKarthik has been into Design and Development of tools for infrastructure as code, software testing performance & benchmarking & chaos engineering. Currently, he is one of the maintainers of the OpenEBS & Litmus opensource projects. In his free time, he learns about Indian classical music, philosophy & literature. \n\n\U0001F426 https://twitter.com/ksatchit\n\U0001F9E9 https://github.com/ksatchit\n\n\n\n\U0001F528 About the Technologies\n\nLitmus\n\nLitmus is a toolset to do cloud-native chaos engineering. Litmus provides tools to orchestrate chaos on Kubernetes to help SREs find weaknesses in their deployments. SREs use Litmus to run chaos experiments initially in the staging environment and eventually in production to find bugs, vulnerabilities. Fixing the weaknesses leads to increased resilience of the system.\nLitmus takes a cloud-native approach to create, manage and monitor chaos. Chaos is orchestrated using the following Kubernetes Custom Resource Definitions (CRDs):\n- ChaosEngine: A resource to link a Kubernetes application or Kubernetes node to a - ChaosExperiment. ChaosEngine is watched by Litmus' Chaos-Operator which then invokes Chaos-Experiments\n- ChaosExperiment: A resource to group the configuration parameters of a chaos experiment. ChaosExperiment CRs are created by the operator when experiments are invoked by ChaosEngine.\n- ChaosResult: A resource to hold the results of a chaos-experiment. The Chaos-exporter reads the results and exports the metrics into a configured Prometheus server.\n\n\n\U0001F30F https://litmuschaos.io/\n\U0001F426 https://twitter.com/LitmusChaos\n\U0001F9E9 https://github.com/litmuschaos/litmus"
publishedAt: 2021-03-03T17:00:00.000Z
technologies:
  - litmus
show: rawkode-live
videoId: oua0v79haem7e7klh0bwydsw
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 30
    title: Introductions
  - startTime: 52
    title: Introduction & Topic Overview
  - startTime: 85
    title: Guest Introductions (Ooma and Kartik)
  - startTime: 262
    title: Transition to Presentation
  - startTime: 270
    title: What is Chaos Engineering & Litmus?
  - startTime: 293
    title: What is Chaos Engineering? (Traditional vs. Proactive)
  - startTime: 373
    title: Principles of Cloud-Native Chaos Engineering
  - startTime: 625
    title: Introducing the Litmus Project
  - startTime: 672
    title: Litmus Project Status & Traction
  - startTime: 743
    title: 'Litmus Use Cases (CI/CD, Production)'
  - startTime: 794
    title: Litmus Architecture Overview
  - startTime: 890
    title: Chaos Experiments and the Chaos Hub
  - startTime: 983
    title: Observability with Litmus
  - startTime: 1005
    title: 'Litmus Integrations (CI/CD Tools, Captain)'
  - startTime: 1039
    title: Chaos on Non-Kubernetes Targets
  - startTime: 1095
    title: Chaos Native Services
  - startTime: 1140
    title: Questions
  - startTime: 1145
    title: Q&A Start
  - startTime: 1150
    title: 'Q&A: Importance of Observability for Chaos'
  - startTime: 1348
    title: 'Q&A: Running Chaos in Different Environments'
  - startTime: 1499
    title: 'Q&A: Litmus Resource Requirements'
  - startTime: 1640
    title: 'Q&A: Scheduling Chaos'
  - startTime: 1709
    title: Demo Start & Agenda
  - startTime: 1725
    title: Demo Overview
  - startTime: 1800
    title: Installing Litmus
  - startTime: 1810
    title: Litmus Portal Installation
  - startTime: 2002
    title: Accessing the Litmus Portal UI
  - startTime: 2080
    title: 'Exploring the Litmus Portal Features (Workflows, Hubs, Targets)'
  - startTime: 2125
    title: Litmus Dashboard / UI / Hubs
  - startTime: 2310
    title: Deploying our First Experiment
  - startTime: 2448
    title: Application Chaos Demo Setup (Kafka)
  - startTime: 3075
    title: Running the Kafka Chaos Experiment
  - startTime: 3249
    title: Explaining the Chaos Workflow & Hypothesis (Probes)
  - startTime: 3275
    title: Kafka Chaos Experiment
  - startTime: 3470
    title: Resilience Grading Explained
  - startTime: 3641
    title: Viewing Workflow Execution & Experiment Pods
  - startTime: 3670
    title: Observing Kafka Logs and Grafana During Chaos
  - startTime: 3813
    title: Viewing Experiment Pod Logs and Chaos Results
  - startTime: 3927
    title: Non-Kubernetes Chaos Demo (AWS EC2 Termination)
  - startTime: 4026
    title: Demos Concluded & Open Q&A
  - startTime: 4033
    title: 'Q&A: Extending Probe Types'
  - startTime: 4560
    title: Questions
  - startTime: 4769
    title: 'Q&A: Attacking Kubernetes Control Plane & Infra Components'
  - startTime: 5000
    title: Failing Chaos Demo
  - startTime: 5229
    title: Conclusion and Farewell
duration: 5350
---

