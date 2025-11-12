---
id: hands-on-introduction-to-gitgat
slug: hands-on-introduction-to-gitgat
title: Hands-on Introduction to GitGat
description: >-
  SCM (Source Control Management) security is of high importance as it serves as
  an entry point to the whole CI/CD pipeline. This repository contains policies
  that verify SCM (currently GitHub's) organization/repositories/user accounts
  security. The policies are evaluated using Open Policy Agent (OPA).


  There are different sets of policies depending on which account is being
  evaluated. Most policies are only relevant for organization owners. See the
  rulesets section bellow.


  The policies are evaluated against a certain state. When executed for the
  first time, the state is empty. The returned data should be reviewed, and the
  security posture should be manually evaluated (with recommendations from each
  module). If the state is approved, it should be added to the input data, so
  that the next evaluation of policies tracks the changes of the state. More
  information about the state configurable for each module is available in each
  module's corresponding section.
publishedAt: 2023-03-09T17:00:00.000Z
technologies: []
show: rawkode-live
videoId: ziso8d5pctrrqhxqeqbgvkfo
chapters:
  - startTime: 0
    title: Introduction
  - startTime: 167
    title: Introduction & Guest Welcome
  - startTime: 193
    title: Guest Introduction
  - startTime: 224
    title: 'Guest Introduction: Barak from Scribe Security'
  - startTime: 301
    title: Software Supply Chain Security & Scribe Overview
  - startTime: 400
    title: 'Introducing GitGat: SCM Security Posture'
  - startTime: 436
    title: GitGat Features & Benefits
  - startTime: 680
    title: The Logo
  - startTime: 720
    title: Should repositories run GitGat
  - startTime: 878
    title: Getting a GitHub personal access token
  - startTime: 970
    title: Creating a GitHub personal access token
  - startTime: 1165
    title: Running GitGat
  - startTime: 1550
    title: Security audits
  - startTime: 1590
    title: GitGat Security Audit
  - startTime: 1705
    title: TwoFactor Authentication
  - startTime: 1940
    title: Branch Protection Rules
  - startTime: 2390
    title: Running the Report on GitHub
  - startTime: 2750
    title: Troubleshooting
  - startTime: 2930
    title: State
  - startTime: 3160
    title: Sample Input
  - startTime: 3625
    title: Customizing Checks & Policies (Rego)
  - startTime: 3651
    title: GitGat Linux Foundation Course
  - startTime: 3877
    title: GitGat Roadmap & Future Plans (GitLab & More Checks)
  - startTime: 3993
    title: Encouraging Exploration & Contribution
  - startTime: 4045
    title: Conclusion & Wrap-up
  - startTime: 4270
    title: GitGat GitHub Repository Overview
  - startTime: 4479
    title: 'Getting Started: Generating a GitHub Personal Access Token (PAT)'
  - startTime: 4506
    title: How GitGat Works (OPA/Rego & GitHub API)
  - startTime: 4600
    title: Creating the GitHub Token (UI Demonstration)
  - startTime: 4950
    title: Running GitGat Locally (Eval Command & JSON Output)
  - startTime: 5132
    title: Viewing the GitGat Report (Gist Demonstration)
  - startTime: 5204
    title: 'Report Details: Public Access Check'
  - startTime: 5321
    title: 'Report Details: Two-Factor Authentication (TFA) Check'
  - startTime: 5400
    title: 'Report Details: Admin Permissions Check'
  - startTime: 5468
    title: 'Report Details: Teams & Collaborators Checks'
  - startTime: 5523
    title: 'Report Details: Branch Protection Rules Check'
  - startTime: 5740
    title: 'Discussion: Continuous Monitoring & Improvement'
  - startTime: 5948
    title: Running GitGat Continuously (GitHub Actions Setup)
  - startTime: 6048
    title: 'Report Details: Signed Commits Check'
  - startTime: 6057
    title: 'Report Details: Deploy Keys & SSH Keys Checks'
  - startTime: 6210
    title: Scheduling GitGat Runs (Cron Expression)
  - startTime: 6537
    title: Understanding GitGat State
  - startTime: 6728
    title: Configuring State with the Input File (Sample)
  - startTime: 6840
    title: Custom File Permissions Check Example (Using State)
duration: 4281
---

