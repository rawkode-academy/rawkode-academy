# External Secrets Operator

This package installs External Secrets Operator through Flux.

Why this replaces the Infisical operator here:

1. ESO centralizes Infisical auth in a `SecretStore` or `ClusterSecretStore`.
2. Each `ExternalSecret` only references that store with `secretStoreRef`.
3. This fits the "shared auth, many synced secrets" model better than attaching auth to each Infisical CRD.

Notes:

1. The Infisical provider examples below use `hostAPI: https://app.infisical.com/api`.
2. The repo's existing CLI config stores `infisical.siteUrl` in [`clusters/production.yaml`](../../clusters/production.yaml) as the same base URL.
3. `cluster bootstrap-secrets` creates a dedicated Infisical machine identity for ESO and writes the generated Universal Auth credentials into the `external-secrets` namespace.
4. The managed role is read-only and only permits secrets in the selected Infisical environment that are tagged `kubernetes`.
5. The default store scope is `secretsPath: /`, so `ExternalSecret` resources can read any tagged secret in the project without assuming an extra `/production` folder.

Verification:

1. `kubectl -n flux-system get helmrelease external-secrets`
2. `kubectl -n external-secrets get deploy,pods`
3. `kubectl get crd | rg external-secrets.io`

Examples:

1. Prefer `go run . cluster bootstrap-secrets --cluster production` to reconcile the auth secret and `ClusterSecretStore`.
2. [`examples/universal-auth-credentials.secret.example.yaml`](./examples/universal-auth-credentials.secret.example.yaml) is only a manual fallback if you need to create the auth secret yourself.
3. Customize and apply [`examples/cluster-secret-store.universal-auth.example.yaml`](./examples/cluster-secret-store.universal-auth.example.yaml) if you need a manual store example.
4. Customize and apply [`examples/external-secret.example.yaml`](./examples/external-secret.example.yaml) for workload-level secret sync.
