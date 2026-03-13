# NetBird Kubernetes Operator

Deploys the NetBird Kubernetes Operator and the NetBird operator configuration chart via Flux.

This package depends on the shared `cert-manager` GitOps package because the upstream NetBird chart creates `Certificate` and `Issuer` resources.

## What this enables

- Service exposure from Kubernetes into the NetBird network via Service annotations (`netbird.io/expose: "true"`).
- Automatic policy creation from Service annotations (`netbird.io/policy*`) by enabling `ingress.allowAutomaticPolicyCreation`.
- Routing peer deployment for ingress with `router.enabled: true` in the `netbird-operator-config` chart.

## Required secret

The NetBird management API token is synced by External Secrets Operator from Infisical into the `netbird` namespace:

- Infisical path: `/projects/rawkode-cloud/NETBIRD_KUBERNETES_TOKEN`
- Kubernetes Secret: `netbird-mgmt-api-key`
- Kubernetes key: `NB_API_KEY`

This assumes the shared `ClusterSecretStore` named `infisical` has already been bootstrapped by the `external-secrets` package.

Use a NetBird service-user token with write access. For this operator package, use an `Admin` service user token rather than a user-scoped read-only token, because the operator creates and updates NetBird resources on your behalf.

## Verification

Check more than the HelmRelease and pod status:

```sh
kubectl -n netbird get externalsecret,secret,pods,nbroutingpeer
kubectl -n netbird get nbroutingpeer router -o yaml
```

`NBRoutingPeer/router` must report `Ready=True`. A running operator pod is not sufficient if the NetBird API token cannot create or update resources.
