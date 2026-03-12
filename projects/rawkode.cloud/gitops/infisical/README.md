# Infisical Kubernetes Operator

This package installs the Infisical Kubernetes Operator through Flux.

It intentionally installs only the operator. The example auth and `InfisicalSecret` manifests under [`examples/`](./examples) are not part of the reconciled kustomization because they contain placeholders for project slugs, namespaces, and machine identity configuration.

Notes:

1. The operator examples use `hostAPI: https://app.infisical.com/api`. This is different from the repo's existing `infisical.siteUrl`, which is stored as `https://app.infisical.com` for the Go SDK client.
2. The operator CRDs use `projectSlug`, not the `projectId` stored in [`clusters/production.yaml`](../../clusters/production.yaml).
3. Infisical's Kubernetes overview currently lists Kubernetes `1.29` through `1.33` as supported. This repo's production cluster config is pinned to `1.35.0`, so treat the deployment as unverified until it is tested on-cluster.
4. The chart is pinned to `0.10.26`, matching Infisical's latest operator release published on March 3, 2026.

Verification:

1. `kubectl -n flux-system get helmrelease infisical-operator`
2. `kubectl -n infisical-operator-system get pods`
3. `kubectl get crd | rg infisical`

Kubernetes Auth flow:

1. Apply [`examples/kubernetes-auth-token-reviewer.example.yaml`](./examples/kubernetes-auth-token-reviewer.example.yaml) to create the reviewer service account and auth-delegator binding.
2. Configure the Kubernetes auth method in Infisical using the reviewer JWT, cluster CA certificate, and service account issuer from the cluster.
3. Create a machine identity in Infisical that is allowed to read the target secrets path for the workload namespace.
4. Customize and apply [`examples/kubernetes-auth-workload-service-account.example.yaml`](./examples/kubernetes-auth-workload-service-account.example.yaml) and [`examples/infisical-secret.kubernetes-auth.example.yaml`](./examples/infisical-secret.kubernetes-auth.example.yaml).

Universal Auth flow:

1. Create a machine identity with Universal Auth enabled in Infisical.
2. Customize and apply [`examples/universal-auth-credentials.secret.example.yaml`](./examples/universal-auth-credentials.secret.example.yaml) with the generated client ID and client secret.
3. Customize and apply [`examples/infisical-secret.universal-auth.example.yaml`](./examples/infisical-secret.universal-auth.example.yaml).
