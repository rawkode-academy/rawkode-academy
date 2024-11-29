```shell
## Flux Service Account

```shell
gcloud projects add-iam-policy-binding rawkode-academy-production \
      --role=roles/artifactregistry.reader \
      --member="serviceAccount:rawkode-academy-production.svc.id.goog[flux-system/source-controller]"
flux install
```
