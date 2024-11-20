---
shell: bash
---

# CloudNativePG

## Deployment

We leverage GKE and ConfigSync, so to deploy we need to push our manifests to Artifact Repository.

```shell {"name": "deploy"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"
export MAJOR_MINOR_VERSION="1.24"
export PATCH_VERSION="1"

curl -o cloudnative-pg.yaml https://raw.githubusercontent.com/cloudnative-pg/cloudnative-pg/release-${MAJOR_MINOR_VERSION}/releases/cnpg-${MAJOR_MINOR_VERSION}.${PATCH_VERSION}.yaml

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf cloudnative-pg.tar.gz cloudnative-pg.yaml

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/cloudnative-pg:v1 cloudnative-pg.tar.gz

```

## Flux Service Account

```shell

gcloud projects add-iam-policy-binding rawkode-academy-production \
      --role=roles/artifactregistry.reader \
      --member="serviceAccount:rawkode-academy-production.svc.id.goog[flux-system/source-controller]"
```

## One Time Setup

```shell {"name": "register"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

cat <<EOF | kubectl apply -f -
apiVersion: source.toolkit.fluxcd.io/v1beta2
kind: OCIRepository
metadata:
  name: cloudnative-pg
  namespace: flux-system
spec:
  provider: gcp
  interval: 5m0s
  url: oci://${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/cloudnative-pg
  ref:
    tag: v1
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: cloudnative-pg
  namespace: flux-system
spec:
  interval: 30m0s
  path: ./
  prune: true
  retryInterval: 2m0s
  sourceRef:
    kind: OCIRepository
    name: cloudnative-pg
  timeout: 3m0s
  wait: true
EOF
```
