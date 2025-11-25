#!/usr/bin/env bash

export SECRET_NAME="cloudflare-workers-token"

export PROJECT_ID="458678766461"
export POOL_ID="github"
export WORKLOAD_IDENTITY_POOL_ID="projects/${PROJECT_ID}/locations/global/workloadIdentityPools/${POOL_ID}"

gcloud secrets add-iam-policy-binding ${SECRET_NAME} \
 --project="${PROJECT_ID}" \
 --role="roles/secretmanager.secretAccessor" \
 --member="principalSet://iam.googleapis.com/${WORKLOAD_IDENTITY_POOL_ID}/attribute.repository/rawkode-academy/rawkode-academy"

