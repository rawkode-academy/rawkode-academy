# Rawkode Academy Website

This is the website at https://rawkode.academy

## Local Development

If you don't have [direnv](https://direnv.net) installed, you'll need to source the `.envrc` file for the correct environment variables to be available.

If you don't have access to the secrets, authentication won't work.

We're still considering how to best support this for everyone.

### With Nix

```
nix develop --impure .
dev
```

### Without Nix

If you wanna get up and running, you just need to install bun.

```
npm install -g bun
```

and then install the dependencies with

```
bun install
```

...finally, run the local dev server

```
bun dev
```
