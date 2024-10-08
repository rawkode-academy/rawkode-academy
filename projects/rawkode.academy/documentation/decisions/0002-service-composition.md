---
status: accepted
date: 2024-10-08
decision-makers:
- rawkode
---

# What is a Rawkode Academy Service?

## Context and Problem Statement

The Rawkode Academy is a platform to help Cloud Native developers, so it is only fitting that the Rawkode Academy is built as a Cloud Native application and uses its own platform to explore, build, and test new architectures, techniques, and tools for building Cloud Native software. As such, the Rawkode Academy is a distributed system built with many micro-services using modern and future facing technologies.

While we want to allow individual service authors the ability to adopt whatever technologies they wish, we do want to enforce some structure to enable a familiarity across the service boundaries.


## Decision Drivers

* ALL services **MUST** only use the global API to interact with other services
* All services **MUST** use GraphQL for their read model
* All services **MUST** be able to function in isolation for local development and test
* All services **MUST** expose their read and write models, if they have them, separately
* All services **MUST** publish writes as events for other services to consume

## Decision Outcomes

Every service will be split into multiple components, which in turn act like their own individual micro-services.

### Global Services

#### GraphQL

We use GraphQL Federation to provide a global API for all services that expose a read-model.

Any service that provides a read model must register their schema with the GraphQL Gateway.

#### Restate Cloud

Restate Cloud provides a managed Restate server. Any service that allows write access to their data store must register their services and workflows with Restate Cloud.

##### Immutable Deployments

Each service **MUST** register a new URL for each deployment / change to their write model.

Any pending or scheduled jobs within Restate **MUST** be able to resume their invocation with the exact version of the write model it was invoked with.

At some point we may point a cap on the time to live for these services, but none exists at the time of writing.

### Service Components

#### Data Model

Each service will have a data model component that is responsible for managing the schema, when required, for their data store of choice.

It is encouraged, but not enforced, to use libSQL; as this provides the simplest experience for local development and production.

Migrations are discouraged, but not enforced. The GraphQL architecture allows for extending service schema through aggregation and new services are preferred, even for individual columns.

#### Read Model

Each service will have a read model component that is responsible for allowing GraphQL access to their data, when required.

#### Write Model

Each service will have a write model component that is responsible for facilitating writes to their data store, when required.

### Consequences

To be discussed
