---
shell: bash
---

# CloudNativePG

## Deployment

```shell {"name": "deploy"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf cloudnative-pg.tar.gz helm-release.yaml

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/cloudnative-pg:v1.0.1 cloudnative-pg.tar.gz
```
