# Temporal Workflows - YouTube

## Prerequisites

- [Temporalite](https://github.com/temporalio/temporalite/releases)

## Getting Started

You can follow all your executions through the [UI](https://localhost:8233).

```shell
# Start Temporalite
temporalite start --namespace default

# Run the Worker
pnpm run worker

# Run the worker with a watch
pnpm run worker.watch

# Kickoff a Workflow
pnpm run workflow
```
