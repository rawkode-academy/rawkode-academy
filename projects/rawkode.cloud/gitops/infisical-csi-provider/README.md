# Infisical CSI Provider

This package installs the Infisical CSI provider through Flux.

Notes:

1. The provider is installed in `infisical-system`.
2. The provider's Helm chart defaults to `kube-system`; this package overrides that explicitly so the namespace stays predictable.
3. The Infisical CSI integration uses Kubernetes auth for workload access. That means each `SecretProviderClass` declares the machine identity and secret paths to mount.

Verification:

1. `kubectl -n flux-system get helmrelease infisical-csi-provider`
2. `kubectl -n infisical-system get all`
3. `kubectl get secretproviderclasses.secrets-store.csi.x-k8s.io -A`

Examples:

1. Customize and apply [`examples/secret-provider-class.kubernetes-auth.example.yaml`](./examples/secret-provider-class.kubernetes-auth.example.yaml).
2. Apply [`examples/workload.example.yaml`](./examples/workload.example.yaml) to smoke-test the mount path.
