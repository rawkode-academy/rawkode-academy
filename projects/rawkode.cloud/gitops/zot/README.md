# Zot Registry

This package installs a cluster-local zot registry through Flux.

Notes:

1. The upstream chart default `NodePort` service is overridden to `ClusterIP` so the registry stays inside the cluster.
2. Persistence is enabled against the `openebs-single-replica` Mayastor storage class.
3. The registry service address is `zot.zot.svc.cluster.local:5000`.
4. The registry is HTTP-only inside the cluster right now. That is fine for in-cluster clients such as `oras`, `crane`, and `skopeo`, but node-side container runtime configuration is still needed if you want to use this host directly in `Pod.spec.image`.
5. The `HelmRelease` depends on OpenEBS, so Flux will hold Zot until the storage stack is healthy.

Verification:

1. `kubectl -n flux-system get helmrelease zot`
2. `kubectl -n zot get pods,svc,pvc`
3. `kubectl -n zot port-forward svc/zot 5000:5000`
4. `curl -fsSL http://127.0.0.1:5000/v2/_catalog`
