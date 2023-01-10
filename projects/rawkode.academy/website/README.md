# Rawkode Academy Website

This is the source code for the [Rawkode Academy website](https://rawkode.academy).

## Prerequisites

```shell
brew install --cask docker
brew install pnpm
```

## Build

```shell
pnpm install
pnpm run build
```

## Deploy

In-order to deploy the website, you need 1Password CLI installed and logged in.

```shell
op whomai
```

If this doesn't work, ensure you have the "CLI" setting enabled on the "Developer" page of your 1Password desktop application settings.

```shell
pnpm exec dagger deploy
```
