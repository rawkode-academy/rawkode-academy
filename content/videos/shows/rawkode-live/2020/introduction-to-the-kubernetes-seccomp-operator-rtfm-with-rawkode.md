---
id: jk9tbioqoc16ukeec1z9fi5h
slug: introduction-to-the-kubernetes-seccomp-operator-rtfm-with-rawkode
title: Introduction to the Kubernetes Seccomp Operator (RTFM with Rawkode)
description: >-
  Daniel Mangum and Sascha Grunert walk through the Kubernetes seccomp operator:
  what seccomp is, installing the operator, applying profiles to nginx pods,
  tracing blocked syscalls with strace, and generating profiles with podman.
publishedAt: 2020-09-10T17:00:00.000Z
type: live
category: tutorial
technologies:
  - security-profiles-operator
  - kubernetes
  - podman
show: rawkode-live
chapters:
  - startTime: 0
    title: Holding screen
  - startTime: 30
    title: Introductions
  - startTime: 200
    title: What is seccomp and the seccomp operator
  - startTime: 1080
    title: Installing the seccomp operator
  - startTime: 1200
    title: Seccomp profiles
  - startTime: 1860
    title: Deploying nginx with and without a seccomp profile
  - startTime: 3420
    title: Switching to Linux because Docker for Mac wasn't working
  - startTime: 3660
    title: Tracing blocked syscalls
  - startTime: 3840
    title: Listing syscalls with strace
  - startTime: 4170
    title: Using podman to generate seccomp profiles
duration: 5032
guests:
  - daniel-mangum
  - sascha-grunert
resources:
  - type: url
    title: kubernetes-sigs/security-profiles-operator
    url: 'https://github.com/kubernetes-sigs/security-profiles-operator'
    category: code
  - type: url
    title: Security Profiles Operator installation and usage
    url: >-
      https://github.com/kubernetes-sigs/security-profiles-operator/blob/main/installation-usage.md
    category: documentation
  - type: url
    title: Kubernetes seccomp tutorial
    url: 'https://kubernetes.io/docs/tutorials/security/seccomp/'
    category: documentation
  - type: url
    title: podman generate seccomp profiles
    url: 'https://docs.podman.io/en/latest/markdown/podman-generate.1.html'
    category: documentation
---

