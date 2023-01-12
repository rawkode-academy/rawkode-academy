#!/usr/bin/env bash
set -xeo pipefail
echo "GCLOUD_GKE is set, installing auth credential helper"

apt update && apt install --yes curl gnupg 
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
apt update && apt install --yes google-cloud-sdk-gke-gcloud-auth-plugin
