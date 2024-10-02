---
shell: bash
---

#

### User Registration Workflow

```shell '{"name": "deploy-user-registration"}'
export RESTATE_IDENTITY_KEY=""

~/.deno/bin/deployctl deploy --config=deployctl-registered.json --org="Rawkode Academy" --env=RESTATE_IDENTITY_KEY=${RESTATE_IDENTITY_KEY}

echo deno run -A --no-config 'npm:@restatedev/restate' deployments register https://plt-users-registered.deno.dev/
```
