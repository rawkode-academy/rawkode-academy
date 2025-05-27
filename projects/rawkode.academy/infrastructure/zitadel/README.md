---
shell: bash
---

# Zitadel

## GitOps

```shell {"name": "gitops"}
export REGION="europe-west2"
export PROJECT="rawkode-academy-production"

gcloud auth configure-docker ${REGION}-docker.pkg.dev

tar -czf zitadel.tar.gz *.yaml

oras push ${REGION}-docker.pkg.dev/${PROJECT}/rawkode-academy/zitadel:v1.0.50 zitadel.tar.gz
```
