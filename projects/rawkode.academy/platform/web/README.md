---
runme:
  version: v3
shell: bash
---

# Rawkode Academy Website

This is the website at https://rawkode.academy

## Local Development

If you don't have https://direnv.net[direnv] installed, you'll need to source the `.envrc` file for the correct environment variables to be available.

If you don't have access to the secrets, authentication won't work.

We're still considering how to best support this for everyone.

### With Nix

We use [Flox](https://flox.dev) and their hierarchical activations.

```shell
deno run dev
```

### Without Nix

If you wanna get up and running, you just need to install [Deno](https://deno.com).


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
deno run --allow-all npm:astro check
```

## Testing

```shell {"name": "test"}
deno run --allow-all npm:vitest
```

We also provide a useful logging / debugging configuration for tests:

```shell {"name": "test-debug"}
deno run -A npm:vitest \
	--reporter=basic \
	--no-file-parallelism \
	--disable-console-intercept
```

## Deploy

```shell {"name": "deploy"}
op run -- deno run npm:wrangler pages deploy --branch main dist
```
