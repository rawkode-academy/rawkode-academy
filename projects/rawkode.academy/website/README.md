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
deno run dev
```

### Without Nix

If you wanna get up and running, you just need to install
[Deno](https://deno.com).

```shell {"name": "install"}
deno install
```

...finally, run the local dev server

```shell {"name": "dev"}
deno run dev
```

## Checks, Linting, & Formatting

```shell {"name": "check"}
deno fmt .
deno lint .
deno run --allow-all npm:astro check
```

## Testing

```shell {"name": "test"}
deno run test
```

We also provide a useful logging / debugging configuration for tests:

```shell {"name": "test-debug"}
bun run test \
	--reporter=basic \
	--no-file-parallelism \
	--disable-console-intercept
```

## Deploy

```shell {"name": "deploy"}
op run -- bunx wrangler pages deploy --branch main dist
```

## Analytics

This site uses PostHog for all analytics, error tracking, and optional session recording.
Session recordings are sampled at ~10% with inputs masked. No InfluxDB pipeline is used anymore.
