---
shell: bash
---

# Zulip

## Why Not Helm?

Zulip do provide a [Helm chart](https://github.com/zulip/docker-zulip/blob/main/kubernetes/chart/zulip), however; the dependencies cannot be disabled and I don't want to YOLO a Postgres onto my cluster without CloudNative PG.

So this is our generated version from that chart.

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

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/zulip:v1.0.47 archive.tar.gz
```
