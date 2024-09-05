---
shell: bash
---

# Technologies Service

## Local Development

### Dagger

```sh {"id":"01J7P549HE7Q1Z12FB2W8QBB79"}
# Tab One
dagger call dev

# Tab Two
bunx grafbase dev
```

## Production

```sh {"id":"01J7P549HE7Q1Z12FB2X05FMQB","name":"Deploy to Production"}
op run -- dagger call deploy-production --one-password-token=env:ONE_PASSWORD_TOKEN
```
