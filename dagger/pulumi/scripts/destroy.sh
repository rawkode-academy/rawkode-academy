#!/usr/bin/env bash
set -xeo pipefail

pulumi destroy --stack "${PULUMI_STACK}" --yes

