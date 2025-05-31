---
runme:
  version: v3
shell: bash
---

# Google Cloud

## Allow Access to a Specific Secret

```sh {"name":"allow-access-to-secret"}
export SECRET_NAME=""

export PROJECT_ID="458678766461"
export POOL_ID="github"
export WORKLOAD_IDENTITY_POOL_ID="projects/${PROJECT_ID}/locations/global/workloadIdentityPools/${POOL_ID}"

gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
 --project="${PROJECT_ID}" \
 --role="roles/secretmanager.secretAccessor" \
 --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/RawkodeAcademy/RawkodeAcademy"
```
