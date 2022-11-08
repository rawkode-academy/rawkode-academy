#!/usr/bin/env bash
set -xeo pipefail

if test -v GCLOUD_GKE; then
  apt update && apt install --yes curl gnupg python3
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | tee -a /etc/apt/sources.list.d/google-cloud-sdk.list
  curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | apt-key --keyring /usr/share/keyrings/cloud.google.gpg add -
  apt update && apt install --yes google-cloud-cli
  gcloud components install gke-gcloud-auth-plugin
fi

if test -v PULUMI_CONFIG_PASSPHRASE || test -v PULUMI_CONFIG_PASSPHRASE_FILE; then
  echo "PULUMI_CONFIG_PASSPHRASE is set, using a local login"
  pulumi login --local
fi

# Using Pulumi SaaS
# We need to check for an existing stack with the name
# If it exists, refresh the config
# If it doesn't, create the stack
if test -v PULUMI_ACCESS_TOKEN; then
  echo "Setting access token"
  if (pulumi stack ls | grep -e "^${PULUMI_STACK}"); then
    echo "Stack exists, let's refresh"
    pulumi stack select "${PULUMI_STACK}"
    # Could be first deployment, so let's not worry about this failing
    pulumi config refresh --force || true
  else
    echo "Stack does not exist, let's create"
    pulumi stack init "${PULUMI_STACK}"
  fi
else
  # Not using Pulumi SaaS, relying on local stack files
  if test -v PULUMI_STACK_CREATE && test ! -f "Pulumi.${PULUMI_STACK}.yaml"; then
    pulumi stack init "${PULUMI_STACK}"
  fi
fi

case "$PULUMI_RUNTIME" in
  nodejs)
    npm install
    ;;

  *)
    echo -n "unknown"
    ;;
esac

pulumi up --stack "${PULUMI_STACK}" --yes --suppress-outputs

mkdir -p /output
pulumi --stack "${PULUMI_STACK}" stack output --json --show-secrets > /output/json
