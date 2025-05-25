---
title: Adopt Bun + Biome for JS/TS Services
adoptedAt: 2025-05-09
authors: [ "rawkode" ]
---

## Context

Currently, Rawkode Academy utilizes Deno and Bun for its JavaScript/TypeScript services. While Deno has served its purpose, several factors have led us to reconsider this choice and aim for a single runtime:

*   **Sustainability Concerns:** We have more confidence in the long-term sustainability and development trajectory of Bun compared to Deno.
*   **Deno Deploy Issues:** We have encountered operational issues with Deno Deploy.
*   **Lack of Transparency:** The Deno team's roadmap has not been consistently transparent, and their responsiveness to GitHub issues has been lacking.

This ADR proposes migrating to Bun as the primary JavaScript/TypeScript runtime and Biome as the linter/formatter.

**Bun** offers several advantages:
*   **Performance:** Bun is designed for speed, offering faster startup times and execution.
*   **Compatibility:** It aims for broad Node.js compatibility, which can ease migration and integration with existing tools.
*   **All-in-one Toolkit:** Bun includes a test runner, bundler, and package manager, potentially simplifying our development toolchain.

**Biome** provides:
*   **Integrated Tooling:** It combines linting, formatting, and other development tools into a single, cohesive package.
*   **Performance:** Biome is also built with performance in mind.
*   **Opinionated Defaults:** While configurable, Biome's strong defaults can help maintain code consistency across projects.

## Goals / Non-Goals

### Goals

*   Standardize on a single, modern JavaScript/TypeScript runtime (Bun) for all services.
*   Adopt a unified, performant linting and formatting tool (Biome).
*   Improve developer experience through faster tooling and a simplified toolchain.
*   Enhance long-term maintainability and confidence in our core JavaScript/TypeScript stack.
*   Reduce operational friction encountered with previous solutions (e.g., Deno Deploy).

### Non-Goals

*   Achieving 100% feature parity with Deno if it compromises the adoption of Bun's strengths.
*   Immediately migrating all existing services in a "big bang" approach (a phased approach is preferred).
*   Replacing other established backend languages or runtimes used within Rawkode Academy (e.g., Go, Rust) where they are a better fit. This ADR is specific to JS/TS services.
*   Exhaustively evaluating every possible JS/TS runtime and tooling combination. The focus is on the identified benefits of Bun and Biome.

## Decision

We will adopt Bun as the standard runtime for all new and existing JavaScript/TypeScript services within Rawkode Academy.
We will adopt Biome as the standard linter and formatter for all JavaScript/TypeScript projects.

A phased migration plan will be developed for existing services currently running on Deno. New services should be initiated using Bun and Biome from the outset.

## Consequences

### Positive

*   **Improved Performance:** Potentially faster build times, test execution, and application performance.
*   **Simplified Tooling:** Bun's built-in features and Biome's integrated nature may reduce the number of discrete development tools we need to manage.
*   **Increased Developer Confidence:** Aligning with a project (Bun) that we perceive as having a more robust and transparent future.
*   **Enhanced Code Quality and Consistency:** Biome's strong linting and formatting capabilities will help maintain high standards.

### Negative

*   **Migration Effort:** Existing Deno services will require time and effort to migrate to Bun. This includes adapting code, build scripts, and deployment processes.
*   **Learning Curve:** Developers will need to familiarize themselves with Bun and Biome, although the transition from Deno/other JS tools should be relatively smooth.
*   **Ecosystem Maturity:** While Bun is rapidly developing, its ecosystem might not be as mature as Node.js in all areas. This could present challenges for specific libraries or integrations. Biome is also a newer tool compared to established linters/formatters like ESLint and Prettier.
*   **Potential Unknowns:** As with any technology shift, there may be unforeseen challenges or incompatibilities that arise during implementation.

## Alternatives Considered

*   **Sticking with Deno:** This was rejected due to the concerns outlined in the Context section (sustainability, Deno Deploy issues, lack of transparency).
*   **Migrating to Node.js with ESLint/Prettier:** While Node.js is a mature and stable platform, Bun offers potential performance benefits and a more integrated toolchain. Biome also offers a more unified approach compared to managing ESLint and Prettier separately.
