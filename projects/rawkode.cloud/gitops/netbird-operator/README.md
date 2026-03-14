# NetBird Kubernetes Operator

Deploys the NetBird Kubernetes Operator and the NetBird operator configuration chart via Flux.

This package depends on the shared `cert-manager` GitOps package because the upstream NetBird chart creates `Certificate` and `Issuer` resources.

## What this enables

- Service exposure from Kubernetes into the NetBird network via Service annotations (`netbird.io/expose: "true"`).
- Automatic policy creation from Service annotations (`netbird.io/policy*`) by enabling `ingress.allowAutomaticPolicyCreation`.
- Routing peer deployment for ingress with `router.enabled: true` in the `netbird-operator-config` chart.

## Service access requirements

`netbird.io/expose: "true"` only publishes the Service as a NetBird Network Resource. Clients still need an access policy to use it. For automatic policy generation, annotate the Service with:

- `netbird.io/policy`
- `netbird.io/policy-source-groups`
- optionally `netbird.io/policy-name`, `netbird.io/policy-ports`, and `netbird.io/policy-protocol`

Without those policy annotations, the operator creates `NBResource` and `NBGroup` objects, but no `NBPolicy`, so NetBird clients will not be able to resolve or reach the service.

## Pod Security requirements

The NetBird routing peer requests the `NET_ADMIN` capability. On this cluster, Talos configures Pod Security admission with `enforce=baseline` by default, so the `netbird` namespace must be labeled `pod-security.kubernetes.io/{enforce,audit,warn}: privileged` or the `router` Deployment will stay at `0/3` with `FailedCreate` events.

## DNS requirements

For `*.svc.cluster.local` Network Resources, the routing peers must be able to resolve Kubernetes service DNS through cluster DNS. The NetBird account currently needs a domain-specific nameserver group for:

- domains: `svc.cluster.local`, `cluster.local`
- nameserver: the cluster DNS Service IP (`10.96.0.10` in `rawkode-cloud`)
- target group: the routing peer group (`rawkode-cloud`)

If the NetBird account only has public upstream resolvers such as Cloudflare, the router pods will return `NXDOMAIN` for service domains even when the `NBResource` and `NBPolicy` objects are healthy.

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
kubectl -n netbird get deploy router
kubectl -n netbird get events --sort-by=.lastTimestamp
```

`NBRoutingPeer/router` must report `Ready=True`. A running operator pod is not sufficient if the NetBird API token cannot create or update resources.

The `router` Deployment must also have ready replicas. If it does not, inspect the namespace events first; Pod Security admission is the primary failure mode for this package.
