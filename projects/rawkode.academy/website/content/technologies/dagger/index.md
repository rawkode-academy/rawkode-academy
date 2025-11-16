---
description: Dagger is a programmable CI/CD engine that runs your pipelines in containers. It allows you to define your CI/CD pipelines as code, enabling you to run them anywhere, from your local machine to a cloud provider, with the same behavior and results. Dagger leverages containerization to provide reproducibility, portability, and efficiency in your development workflows. It solves the challenges of inconsistent environments and vendor lock-in by providing a unified platform for building, testing, and deploying applications.
name: Dagger
website: https://dagger.io/
documentation: https://docs.dagger.io/
categories: []
---

## Complete Guide to Dagger: Programmable CI/CD Pipelines

Dagger transforms CI/CD from YAML hell into programmable, testable, portable pipelines. If you're tired of debugging CI/CD pipelines that only run in the cloud, fighting platform-specific syntax, or dealing with slow feedback loops, Dagger is the solution.

## What is Dagger?

Dagger is a programmable CI/CD engine that lets you write your pipelines in real programming languages (Go, Python, TypeScript) instead of YAML. Pipelines run in containers, ensuring they work identically on your laptop and in any CI system.

**Core Philosophy:** Your CI/CD pipeline should be code—testable, debuggable, and runnable anywhere.

## Why Dagger?

### Traditional CI/CD vs. Dagger

**Traditional Approach (YAML-based):**
- Different syntax for each CI platform (GitHub Actions, GitLab CI, Jenkins)
- Can't run locally without heavy simulation
- Long feedback loops (push, wait, check logs)
- Limited logic and control flow
- Vendor lock-in

**Dagger Approach:**
- Write once in TypeScript/Python/Go, run anywhere
- Fully functional local execution
- Instant feedback (test locally before pushing)
- Full programming language features
- Platform-agnostic

### Key Benefits

1. **Local Development**: Test pipelines on your laptop before pushing
2. **Reusable**: Share pipeline logic as modules
3. **Fast**: Aggressive caching at every step
4. **Portable**: Same pipeline works in GitHub Actions, GitLab CI, CircleCI, etc.
5. **Testable**: Use your language's testing framework

## Core Concepts

### Functions

Dagger pipelines are collections of functions:

```typescript
// dagger/src/index.ts
import { dag, Container, Directory, object, func } from "@dagger.io/dagger"

@object()
class MyPipeline {
  @func()
  async build(source: Directory): Promise<Container> {
    return dag
      .container()
      .from("node:20-alpine")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["npm", "install"])
      .withExec(["npm", "run", "build"])
  }

  @func()
  async test(source: Directory): Promise<string> {
    return await dag
      .container()
      .from("node:20-alpine")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["npm", "install"])
      .withExec(["npm", "test"])
      .stdout()
  }
}
```

### Containers

Everything runs in containers, ensuring reproducibility:

```python
# dagger/src/main.py
import dagger
from dagger import dag, function, object_type

@object_type
class MyPipeline:
    @function
    async def build(self, source: dagger.Directory) -> dagger.Container:
        return (
            dag.container()
            .from_("golang:1.21-alpine")
            .with_directory("/src", source)
            .with_workdir("/src")
            .with_exec(["go", "build", "-o", "app"])
        )

    @function
    async def test(self, source: dagger.Directory) -> str:
        return await (
            dag.container()
            .from_("golang:1.21-alpine")
            .with_directory("/src", source)
            .with_workdir("/src")
            .with_exec(["go", "test", "./..."])
            .stdout()
        )
```

### Modules

Reuse and share pipeline logic:

```bash
# Use a published module
dagger call -m github.com/kpenfound/dagger-modules/golang@v0.1.0 \
  build --source=.

# Create your own module
dagger init --name=my-pipeline --sdk=typescript
```

### Caching

Dagger caches every operation automatically:

```typescript
@func()
async buildOptimized(source: Directory): Promise<Container> {
  // This layer is cached if package.json hasn't changed
  const deps = dag
    .container()
    .from("node:20-alpine")
    .withDirectory("/app", source, { include: ["package*.json"] })
    .withWorkdir("/app")
    .withExec(["npm", "install"])

  // Source code changes don't invalidate dependency cache
  return deps
    .withDirectory("/app", source)
    .withExec(["npm", "run", "build"])
}
```

## Getting Started with Dagger

### Installation

```bash
# macOS
brew install dagger/tap/dagger

# Linux
curl -L https://dl.dagger.io/dagger/install.sh | sh

# Windows
iwr https://dl.dagger.io/dagger/install.ps1 -useb | iex

# Verify installation
dagger version
```

### Initialize a New Project

```bash
# Create a new Dagger module
dagger init --name=my-app --sdk=typescript

# Project structure:
# dagger/
# ├── dagger.json
# ├── src/
# │   └── index.ts
# └── tsconfig.json
```

### Your First Pipeline

```typescript
// dagger/src/index.ts
import { dag, Container, Directory, object, func } from "@dagger.io/dagger"

@object()
class MyApp {
  @func()
  async build(source: Directory): Promise<Container> {
    return dag
      .container()
      .from("node:20-alpine")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["npm", "install"])
      .withExec(["npm", "run", "build"])
  }

  @func()
  async test(source: Directory): Promise<string> {
    return await this.build(source)
      .withExec(["npm", "test"])
      .stdout()
  }

  @func()
  async publish(source: Directory, registry: string, tag: string): Promise<string> {
    return await this.build(source)
      .withLabel("org.opencontainers.image.source", "https://github.com/myorg/myapp")
      .publish(`${registry}:${tag}`)
  }
}
```

Run it:

```bash
# Run locally
dagger call build --source=.

# Run tests
dagger call test --source=.

# Publish
dagger call publish --source=. --registry=ghcr.io/myorg/myapp --tag=v1.0.0
```

## Common Use Cases

### 1. Multi-Language Monorepo

Build different services in different languages:

```typescript
@object()
class Monorepo {
  @func()
  async buildBackend(source: Directory): Promise<Container> {
    return dag
      .container()
      .from("golang:1.21")
      .withDirectory("/src", source, { include: ["backend/**"] })
      .withWorkdir("/src/backend")
      .withExec(["go", "build", "-o", "api"])
  }

  @func()
  async buildFrontend(source: Directory): Promise<Container> {
    return dag
      .container()
      .from("node:20")
      .withDirectory("/src", source, { include: ["frontend/**"] })
      .withWorkdir("/src/frontend")
      .withExec(["npm", "install"])
      .withExec(["npm", "run", "build"])
  }

  @func()
  async buildAll(source: Directory): Promise<string> {
    await this.buildBackend(source)
    await this.buildFrontend(source)
    return "All services built successfully"
  }
}
```

### 2. Integration with GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dagger/dagger-for-github@v5
        with:
          version: "latest"
      - name: Build and Test
        run: |
          dagger call build --source=.
          dagger call test --source=.
```

### 3. End-to-End Testing

```typescript
@object()
class E2ETests {
  @func()
  async runTests(source: Directory): Promise<string> {
    // Start backend
    const backend = dag
      .container()
      .from("golang:1.21")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withExec(["go", "run", "main.go"])
      .withExposedPort(8080)
      .asService()

    // Start frontend pointing to backend
    const frontend = dag
      .container()
      .from("node:20")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withServiceBinding("backend", backend)
      .withEnvVariable("API_URL", "http://backend:8080")
      .withExec(["npm", "start"])
      .withExposedPort(3000)
      .asService()

    // Run E2E tests against frontend
    return await dag
      .container()
      .from("mcr.microsoft.com/playwright:latest")
      .withServiceBinding("frontend", frontend)
      .withDirectory("/tests", source, { include: ["tests/**"] })
      .withWorkdir("/tests")
      .withExec(["npx", "playwright", "test", "--baseURL=http://frontend:3000"])
      .stdout()
  }
}
```

### 4. Multi-Platform Builds

```typescript
@func()
async buildMultiPlatform(source: Directory): Promise<string> {
  const variants: Container[] = []

  for (const platform of ["linux/amd64", "linux/arm64"]) {
    const container = dag
      .container({ platform: platform as Platform })
      .from("golang:1.21-alpine")
      .withDirectory("/src", source)
      .withWorkdir("/src")
      .withExec(["go", "build", "-o", "app"])

    variants.push(container)
  }

  return await dag
    .container()
    .publish("ghcr.io/myorg/myapp:latest", { platformVariants: variants })
}
```

## Best Practices

### 1. Layer Caching Strategy

Optimize cache hits:

```typescript
// Bad: Copying everything invalidates cache on any file change
const bad = dag
  .container()
  .from("node:20")
  .withDirectory("/app", source)
  .withExec(["npm", "install"]) // Cache invalidated often

// Good: Copy dependencies first
const good = dag
  .container()
  .from("node:20")
  .withDirectory("/app", source, { include: ["package*.json"] })
  .withExec(["npm", "install"]) // Cache preserved
  .withDirectory("/app", source) // Add source after
```

### 2. Secrets Management

Handle secrets securely:

```typescript
@func()
async deployWithSecrets(source: Directory, apiKey: Secret): Promise<string> {
  return await dag
    .container()
    .from("alpine:latest")
    .withDirectory("/app", source)
    .withSecretVariable("API_KEY", apiKey)
    .withExec(["sh", "-c", "deploy.sh"]) // API_KEY available in script
    .stdout()
}

// Usage:
// dagger call deploy-with-secrets --source=. --api-key=env:API_KEY
```

### 3. Parallel Execution

Speed up pipelines with parallelism:

```typescript
@func()
async ciPipeline(source: Directory): Promise<string> {
  // Run lint, test, and build in parallel
  const [lintResult, testResult, buildResult] = await Promise.all([
    this.lint(source),
    this.test(source),
    this.build(source)
  ])

  return "All checks passed"
}
```

### 4. Module Composition

Reuse existing modules:

```typescript
import { dag } from "@dagger.io/dagger"

@func()
async buildWithGolang(source: Directory): Promise<Container> {
  // Use the official Golang module
  return await dag
    .golang()
    .build(source)
}
```

## Dagger vs. Alternatives

### Dagger vs. GitHub Actions

| Feature | Dagger | GitHub Actions |
|---------|--------|----------------|
| **Local Execution** | Native | Limited (act) |
| **Language** | TypeScript/Python/Go | YAML + limited JS |
| **Portability** | Any CI platform | GitHub only |
| **Caching** | Aggressive, automatic | Manual setup |
| **Debugging** | Full IDE support | Log inspection only |

### Dagger vs. Earthly

| Feature | Dagger | Earthly |
|---------|--------|---------|
| **Language** | TypeScript/Python/Go | Earthfile (Dockerfile-like) |
| **Learning Curve** | Moderate | Lower (familiar syntax) |
| **Flexibility** | High (full language) | Medium (DSL) |
| **Ecosystem** | Growing | Established |

## Troubleshooting

```bash
# View detailed logs
dagger call build --source=. --debug

# Check Dagger engine status
dagger version

# Clear cache
dagger run --cleanup

# Interactive debugging
dagger call build --source=. --terminal
```

## Learning Path

### Beginner
1. Install Dagger and run hello world
2. Convert a simple shell script to Dagger
3. Learn container basics (from, withExec, with Directory)
4. Run Dagger in your CI platform
5. Understand caching strategies

### Intermediate
1. Build multi-step pipelines
2. Use secrets and environment variables
3. Compose with existing modules
4. Implement parallel execution
5. Optimize cache hits

### Advanced
1. Create reusable modules
2. Multi-platform builds
3. Complex service dependencies
4. Custom integrations (databases, external APIs)
5. Contribute modules to the community

## Conclusion

Dagger brings software engineering practices to CI/CD. By treating pipelines as code, you get testability, reusability, and portability that YAML-based systems simply can't provide.

The ability to run pipelines locally transforms the development experience—no more pushing commits just to test CI changes. Combined with aggressive caching and true portability, Dagger represents the future of CI/CD.

Start small by converting one script to Dagger, experience the faster feedback loop, and gradually expand to your entire CI/CD process.

**Ready to see Dagger in action?** Check out our hands-on videos and tutorials below for real-world pipeline examples.
