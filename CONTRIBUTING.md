---
shell: bash
---

# Contributing

Welcome! We love that you'd like to contribute to the Rawkode Academy.

## Secrets

If you've provided your age key, you'll have likely been allocated access to the secrets you require to contribute.

You can test this by accessing the available-to-all Cloudflare Account ID.

First, you'll need to create `.env.local` in the root if this repository and provide your AGE private key. This file
is ignored by Git, but mistakes do happen. You may wish to expose it via 1Password or A N Other password manager:

```
export SOPS_AGE_KEY_LOCAL="op://Employee/Age Key/password"
```

### Test Your Access

```shell {"name": "Test SOPs Access"}
sops exec-file sops.yaml 'cat {}'
```
