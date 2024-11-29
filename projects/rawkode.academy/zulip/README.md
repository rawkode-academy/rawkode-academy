---
shell: bash
---

# Zulip

## Custom PostgreSQL Image

```shell {"name": "publish-postgresql"}
POSTGRESQL_VERSION=16
BUILD_INCREMENT=001

podman image build -f zulip-postgresql.Containerfile -t europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/zulip-postgresql:${POSTGRESQL_VERSION}-zulip-${BUILD_INCREMENT}
podman image push europe-west2-docker.pkg.dev/rawkode-academy-production/rawkode-academy/zulip-postgresql:${POSTGRESQL_VERSION}-zulip-${BUILD_INCREMENT}
```

## GitOps

```shell {"name": "gitops"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf archive.tar.gz *.yaml

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/zulip:v1.0.15 archive.tar.gz
```
