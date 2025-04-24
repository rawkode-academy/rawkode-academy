---
title: Adopt Architecture Decision Records (ADRs)
createdAt: 2025-04-25
authors: ["icepuma", "rawkode"]
---

## Background and Motivation

We want to set stricter boundaries for ourselves and make all technology choices
transparent to the public, hence we're establishing the format of ADRs.

## Goals and Non-Goals

### Goals

- Comprehensible
- We accept and implement the decision made in the ADRs

### Non-Goals

- Be set in stone forever, new ADRs can supersede older ones

## Detailed Design

- We're using
  [Google Design Docs](https://medium.com/@alessandro.traversi/mastering-google-design-docs-a-comprehensive-guide-with-readme-md-template-a2706b57f64d)
  as a loose template.
- ADRs live inside
  [content/adrs](https://github.com/RawkodeAcademy/RawkodeAcademy/tree/main/projects/rawkode.academy/website/content/adrs/)
- ADRs are named `<zero-lead-four-digit-prefix>-<some-nice-file-name>.<md|mdx>`
- As long as an ADR only contains a `createdAt` date it's in the state of
  `Proposed`, as soon as the ADR contains a `adoptedAt` date it transitions in
  to the state `Adopted`
- Everyone can open an ADR via pull request. A constructive discussion in the
  pull request decides whether the ADR gets adopted or not

## Conclusion

The concept of ADR will help us to focus on the real problems and prevents us to
switch technologies too often.
