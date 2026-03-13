# cert-manager

Deploys cert-manager through Flux.

This is a cluster dependency for charts that create `cert-manager.io` resources, including the NetBird Kubernetes operator.

CRDs are installed by the chart via `crds.enabled: true`.
