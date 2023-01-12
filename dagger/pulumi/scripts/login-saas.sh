#!/usr/bin/env bash
set -xeo pipefail

# Using Pulumi SaaS
# We need to check for an existing stack with the name
# If it exists, refresh the config
# If it doesn't, create the stack
echo "PULUMI_ACCESS_TOKEN is set, using Pulumi SaaS"
pulumi login

if (pulumi stack ls | grep -e "^${PULUMI_STACK}"); then
    echo "Stack exists, let's refresh"
    pulumi stack select "${PULUMI_STACK}"
    # Could be first deployment, so let's not worry about this failing
    pulumi config refresh --force || true
else
    echo "Stack does not exist, let's create"
    pulumi stack init "${PULUMI_STACK}"
fi
