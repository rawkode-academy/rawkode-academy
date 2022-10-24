# Rawkode Academy CMS

## auth

> Authenticate with GitHub container registry using Doppler

```sh
doppler run -- bash -c 'echo $GITHUB_TOKEN' | docker login ghcr.io -u rawkode --password-stdin
```

## build

> Builds the server and client side container images

```sh
docker buildx bake --push
```
