---
shell: bash
---

# Zitadel

## Deploy

```shell {name=deploy}
fly deploy
```

## GitOps

```shell {"name": "gitops"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf zitadel.tar.gz ./kubernetes

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/zitadel:v1.0.9 zitadel.tar.gz
```


## One Time Setup

```shell {"name": "register"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

cat <<EOF | kubectl apply -f -
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: zitadel
  namespace: flux-system
spec:
  provider: gcp
  interval: 5m0s
  url: oci://${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/zitadel
  ref:
    tag: v1
---
apiVersion: v1
kind: Namespace
metadata:
  name: zitadel
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: zitadel
  namespace: flux-system
spec:
  interval: 15m0s
  path: ./
  prune: true
  retryInterval: 2m0s
  sourceRef:
    kind: OCIRepository
    name: zitadel
  timeout: 3m0s
  targetNamespace: zitadel
  wait: true
EOF
```
