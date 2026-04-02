---
runme:
  version: v3
shell: bash
---

# Rawkode Academy Website

This is the website at https://rawkode.academy.

## Local Development

If you don't have https://direnv.net[direnv] installed, you'll need to source
the `.envrc` file for the correct environment variables to be available.

If you don't have access to the secrets, authentication won't work.

We're still considering how to best support this for everyone.

### With Nix

We use [Flox](https://flox.dev) and their hierarchical activations.

```shell
cuenv task dev
```

### Without Nix

If you want to get up and running manually, install Bun and the workspace
dependencies first.

```shell {"name": "install"}
bun install
```

Then start the local dev server:

```shell {"name": "dev"}
bun run dev
```

`astro dev` already runs through Cloudflare's native Vite plugin and `workerd`
via `@astrojs/cloudflare`, so there is no separate `wrangler dev` workflow to
maintain here.

## Checks, Linting, & Formatting

```shell {"name": "check"}
bun run format
bun run build
```

## Testing

```shell {"name": "test"}
bun run test
```

## Core Web Vitals Monitoring

```shell {"name": "cwv"}
bun run check:cwv
```

Set `PAGESPEED_API_KEY` to avoid API rate limiting in CI and local checks.

We also provide a useful logging / debugging configuration for tests:

```shell {"name": "test-debug"}
bun run test \
	--reporter=basic \
	--no-file-parallelism \
	--disable-console-intercept
```

## Deploy

```shell {"name": "deploy"}
op run -- bunx wrangler deploy
```

## Analytics

This site uses Grafana Faro SDK v2 for frontend observability and the `@rawkode.tools/observability-collector` service for server-side events. All events are sent to PostHog via OTLP.
