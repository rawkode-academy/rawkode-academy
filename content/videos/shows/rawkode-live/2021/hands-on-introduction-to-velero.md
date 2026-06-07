---
id: k85jwdt76e8iww8ljpoykkze
slug: hands-on-introduction-to-velero
title: Hands-on Introduction to Velero
description: >-
  Velero maintainer Carlisia Thompson joins David to install Velero against a
  MinIO S3 backend, back up Kubernetes objects and persistent volumes, then
  simulate a disaster and restore the workload into a fresh namespace.
whatYouWillLearn:
  - "Install Velero with the CLI against a MinIO-backed S3 storage location"
  - "Back up Kubernetes resources and persistent volumes, including selective namespace backups"
  - "Restore a deleted workload into a fresh namespace after simulating disaster"
publishedAt: 2021-04-20T17:00:00.000Z
type: live
category: tutorial
technologies:
  - velero
  - kubernetes
  - minio
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding Screen
  - startTime: 2
    title: 'Guest Introduction: Carlisia Thompson'
  - startTime: 3
    title: What is Project Velero?
  - startTime: 5
    title: Importance and Use Cases of Kubernetes Backup
  - startTime: 7
    title: Preparing for Hands-on Demo
  - startTime: 9
    title: Setting up S3 Compatible Storage (Minio)
  - startTime: 13
    title: Installing Velero Server and CLI
  - startTime: 26
    title: Checking Backup Storage Location Status
  - startTime: 29
    title: 'Multiple Locations, Secrets, and Velero Architecture'
  - startTime: 36
    title: Creating the First Backup (No PV data)
  - startTime: 42
    title: Inspecting Initial Backup Contents
  - startTime: 46
    title: Configuring and Troubleshooting Persistent Volume Backup with Rustic
  - startTime: 49
    title: Introductions
  - startTime: 57
    title: 'Simulating Disaster: Deleting Workload & Data'
  - startTime: 58
    title: Initiating the Restore Process
  - startTime: 61
    title: Verifying Successful Restore
  - startTime: 63
    title: Q&A and Capabilities Review
  - startTime: 65
    title: 'Beyond Basics: Scheduling, Docs, Contributing'
  - startTime: 68
    title: Upcoming Velero Features (v1.7 Roadmap)
  - startTime: 71
    title: Conclusion and Farewell
  - startTime: 225
    title: What is Velero?
  - startTime: 505
    title: Installing Velero
  - startTime: 1530
    title: Creating a Backup
  - startTime: 3480
    title: Restoring a Backup
duration: 4345
guests:
  - carlisia
resources:
  - title: The Podlets podcast
    type: url
    category: other
  - title: Velero resources page
    url: 'https://velero.io/resources/'
    type: url
    category: documentation
  - title: Velero ROADMAP.md
    url: 'https://github.com/vmware-tanzu/velero/blob/main/ROADMAP.md'
    type: url
    category: code
  - title: Velero Tilt integration instructions
    url: 'https://velero.io/docs/main/tilt/'
    type: url
    category: documentation
---
