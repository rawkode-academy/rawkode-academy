---
id: introduction-to-thanos
slug: introduction-to-thanos
title: Introduction to Thanos
description: "Special Guest: Bartłomiej Płotka (https://twitter.com/bwplotka)\n\nBartek Plotka is a Principal Software Engineer at Red Hat with a background in SRE, currently working on OpenShift Observability. As the co-author of the CNCF Thanos project and core maintainer of various open-source projects including Prometheus, he enjoys building OSS communities and maintainable, reliable distributed systems. On top of that, he is active in the CNCF SIG Observability as the technical lead. Volleyball player in free time.\n\nThanos is a set of components that can be composed into a highly available metric system with unlimited storage capacity, which can be added seamlessly on top of existing Prometheus deployments.\n\nThanos is a CNCF Incubating project.\n\nThanos leverages the Prometheus 2.0 storage format to cost-efficiently store historical metric data in any object storage while retaining fast query latencies. Additionally, it provides a global query view across all Prometheus installations and can merge data from Prometheus HA pairs on the fly.\n\nConcretely the aims of the project are:\n\n- Global query view of metrics.\n- Unlimited retention of metrics.\n- High availability of components, including Prometheus.\n\n\U0001F570 Timeline\n\n00:00 - Holding screen\n01:00 - Introductions\n04:50 - What is Thanos?\n20:00 - Generating some fake time series data with thanosbench\n26:00 - Running three Prometheus servers\n40:00 - Running the Thanos sidecars\n45:20 - Running the Thanos querier\n58:10 - Connecting Thanos to S3 / Minio\n1:14:00 - Enabling compaction and downsampling\n\n\U0001F30E Resources\n\nBartek Plotka - https://twitter.com/bwplotka\nThanos - https://thanos.io"
publishedAt: 2020-11-11T17:00:00.000Z
technologies:
  - thanos
show: rawkode-live
videoId: p78opknhykk7739gvc7kf5z5
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 60
    title: Introductions
  - startTime: 67
    title: Introduction to Thanos
  - startTime: 133
    title: Guest Introduction (Bartek Podkała)
  - startTime: 290
    title: What is Thanos?
  - startTime: 324
    title: What is Thanos? (Problem it Solves)
  - startTime: 439
    title: Observability Concepts and Signals
  - startTime: 521
    title: 'Thanos: A Distributed Prometheus'
  - startTime: 613
    title: Thanos Architecture and Components
  - startTime: 781
    title: The Thanos gRPC Store API
  - startTime: 853
    title: Thanos UI and Community/Mentoring
  - startTime: 929
    title: Transition to Live Demo (Katakoda)
  - startTime: 1200
    title: Generating some fake time series data with thanosbench
  - startTime: 1248
    title: 'Demo Setup: Generating Sample Data (Thanos Bench)'
  - startTime: 1560
    title: Running three Prometheus servers
  - startTime: 2000
    title: Accessing Individual Prometheus Instances (UI)
  - startTime: 2400
    title: Running the Thanos sidecars
  - startTime: 2402
    title: Introduction to Thanos Sidecar
  - startTime: 2429
    title: 'Demo: Running Thanos Sidecars'
  - startTime: 2581
    title: 'Debugging: Sidecar Connectivity Issues'
  - startTime: 2720
    title: Running the Thanos querier
  - startTime: 2729
    title: Introduction to Thanos Querier
  - startTime: 2740
    title: 'Demo: Running Thanos Querier'
  - startTime: 2827
    title: Querying with Thanos Querier & Deduplication
  - startTime: 3001
    title: 'Debugging: Querier Connectivity Issues'
  - startTime: 3209
    title: Successful Global Query Demonstration
  - startTime: 3460
    title: Long-Term Storage with Object Storage
  - startTime: 3490
    title: Connecting Thanos to S3 / Minio
  - startTime: 3495
    title: 'Demo Setup: Running Minio (S3 Compatible Storage)'
  - startTime: 3559
    title: Configuring Sidecars for Object Storage Upload
  - startTime: 3996
    title: Introduction to Thanos Store Gateway
  - startTime: 4110
    title: 'Demo: Running Thanos Store Gateway'
  - startTime: 4208
    title: Configuring Querier to include Store Gateway
  - startTime: 4352
    title: Querying Data from Multiple Sources
  - startTime: 4394
    title: Exploring the Thanos UI & Store Filtering
  - startTime: 4440
    title: Enabling compaction and downsampling
  - startTime: 4478
    title: Introduction to Thanos Compactor
  - startTime: 4505
    title: 'Demo: Running Thanos Compactor'
  - startTime: 4628
    title: Thanos Bucket Viewer & Downsampling Explained
  - startTime: 4733
    title: Recap of Thanos Components & Deployment
  - startTime: 4942
    title: Host Summary & Thank You
  - startTime: 5054
    title: 'Community, Contribution, and CNCF SIG Observability'
  - startTime: 5175
    title: Final Wrap-up
duration: 5295
---

