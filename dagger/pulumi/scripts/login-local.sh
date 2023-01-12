#!/usr/bin/env bash
set -xeo pipefail
echo "PULUMI_CONFIG_PASSPHRASE is set, using a local login"
pulumi login --local

if test -v PULUMI_STACK_CREATE && test ! -f "Pulumi.${PULUMI_STACK}.yaml"; then
    pulumi stack init "${PULUMI_STACK}"
fi
