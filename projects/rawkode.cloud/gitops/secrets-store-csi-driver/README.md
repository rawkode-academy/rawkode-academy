# Secrets Store CSI Driver

This package installs the upstream Secrets Store CSI Driver through Flux.

The HelmRelease enables two features that matter for the Infisical provider integration:

1. `syncSecret.enabled=true` so a `SecretProviderClass` can optionally sync mounted data into a Kubernetes `Secret`.
2. `enableSecretRotation=true` so mounted content can refresh without recreating pods.

Verification:

1. `kubectl -n flux-system get helmrelease secrets-store-csi-driver`
2. `kubectl -n kube-system get ds secrets-store-csi-driver`
3. `kubectl get crd | rg secrets-store.csi.x-k8s.io`
