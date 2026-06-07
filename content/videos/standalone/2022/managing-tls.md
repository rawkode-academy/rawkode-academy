---
id: ivg9hwb376cu64psybqhd5k0
slug: managing-tls
title: Managing TLS
description: >-
  Three ways to give Portainer real TLS certificates: keep the built-in self
  signed certs, run Certbot on the host with a systemd timer for renewals, or
  put Caddy in front as a reverse proxy that handles the ACME dance for you.
whatYouWillLearn:
  - "Configure Portainer's built-in SSL certificate settings and force HTTPS only."
  - "Provision Let's Encrypt certificates with Certbot standalone on the host."
  - "Use Caddy as a reverse proxy that renews TLS automatically."
publishedAt: 2022-12-09T17:00:00.000Z
type: recorded
category: tutorial
technologies:
  - portainer
  - docker
chapters:
  - startTime: 0
    title: Introduction and Course Overview
  - startTime: 66
    title: 'Managing TLS: The Focus of This Video'
  - startTime: 86
    title: Default Portainer TLS and Browser Warnings
  - startTime: 147
    title: 'Exploring Alternative TLS Methods (Certbot, Caddy)'
  - startTime: 213
    title: Portainer's Built-in TLS Settings
  - startTime: 279
    title: 'Method 1: Certbot on the Host'
  - startTime: 301
    title: Certbot Installation Steps
  - startTime: 378
    title: Automating Certbot Renewal with systemd
  - startTime: 442
    title: Certbot Certificate Provisioning Demo
  - startTime: 546
    title: Configuring Portainer with Certbot Certificates
  - startTime: 605
    title: Verifying Certbot TLS in the Browser
  - startTime: 621
    title: 'Method 2: Caddy Reverse Proxy'
  - startTime: 670
    title: Setting up Portainer and Caddy Containers
  - startTime: 722
    title: Understanding the Caddyfile Configuration
  - startTime: 807
    title: Caddy Method Demonstration
  - startTime: 848
    title: Summary of TLS Management Methods
  - startTime: 882
    title: Conclusion
duration: 921
guests: []
resources:
  - title: Portainer in Production GitHub Repository
    type: url
    url: 'https://github.com/RawkodeAcademy/portainer-in-production'
    category: code
  - title: Certbot
    type: url
    url: 'https://certbot.eff.org/'
    category: documentation
  - title: Let's Encrypt
    type: url
    url: 'https://letsencrypt.org/'
    category: documentation
  - title: Caddy Documentation
    type: url
    url: 'https://caddyserver.com/docs/'
    category: documentation
  - title: Portainer SSL Certificate Settings
    type: url
    url: 'https://docs.portainer.io/admin/settings#ssl-certificate'
    category: documentation
---
