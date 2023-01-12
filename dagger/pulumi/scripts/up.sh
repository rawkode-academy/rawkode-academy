#!/usr/bin/env bash
set -xeo pipefail

pulumi up --stack "${PULUMI_STACK}" --refresh --yes --suppress-outputs
mkdir -p /output
pulumi --stack "${PULUMI_STACK}" stack output --json --show-secrets > /output/json
