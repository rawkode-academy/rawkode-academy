# CLAUDE.md - Dagger CI/CD Modules

This directory contains custom Dagger modules built with the TypeScript SDK. These modules power CI/CD pipelines throughout the monorepo.

## Module Directory

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| `bun/` | Bun runtime container setup | `install()`, `installNoCache()`, `withCache()` |
| `cloudflare/` | Cloudflare Workers deployment | `deploy()`, `deployDist()`, `deployAssets()`, `preview()`, `applyMigrations()` |
| `deno/` | Deno runtime with cache | `withCache()` |
| `github/` | GitHub API interactions | `postPullRequestComment()` |
| `gitlab/` | GitLab API interactions | `postMergeRequestComment()` |
| `nodejs/` | Node.js/Bun container setup | `withBun()`, `withNPM()` |
| `onepassword/` | 1Password secrets retrieval | `getSecretByReference()` |
| `restate/` | Restate workflow service | `service()` |
| `sops/` | SOPS secrets decryption | `getSecrets()` |
| `sqld/` | LibSQL/Turso server | `service()` |
| `terraform-cdk/` | Terraform CDK orchestration | (depends on bun module) |
| `wundergraph/` | GraphQL schema publishing | `generateAndPublishSubgraph()` |

## Module Structure

Each module follows this structure:

```
module-name/
├── dagger.json         # Module configuration
├── package.json        # Dependencies
├── tsconfig.json       # TypeScript config
└── src/
    └── index.ts        # Module implementation
```

## Development

### Testing a Module Locally

```bash
cd dagger/<module-name>
dagger call <function-name> --help
```

### Module Dependencies

Modules can depend on other modules. Check `dagger.json` for dependencies:

```json
{
  "dependencies": [
    { "name": "bun", "source": "../bun" }
  ]
}
```

## Common Patterns

### Container Caching

Most modules use cache volumes for dependencies:

```typescript
.withMountedCache("/cache-path", dag.cacheVolume("cache-name"), {
  sharing: CacheSharingMode.Shared,
})
```

### Secrets Handling

Pass secrets using the `Secret` type:

```typescript
@func()
async deploy(apiToken: Secret): Promise<string> {
  return container.withSecretVariable("TOKEN", apiToken)...
}
```

### Service Containers

For services (databases, runtime servers):

```typescript
@func()
service(): Service {
  return dag.container().from("image").withExposedPort(8080).asService();
}
```

## Adding a New Module

1. Create directory: `dagger/<module-name>/`
2. Copy structure from an existing module
3. Update `dagger.json` with module name and any dependencies
4. Implement functions in `src/index.ts`
5. Test with `dagger call`

See [Dagger TypeScript SDK docs](https://docs.dagger.io/sdk/typescript) for SDK reference.
