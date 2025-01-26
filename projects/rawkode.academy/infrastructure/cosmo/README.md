---
shell: bash
---

# Cosmo

## GitOps

```shell {"name": "gitops"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf archive.tar.gz *.yaml

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/cosmo:v1.0.12 archive.tar.gz
```
