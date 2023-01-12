#!/usr/bin/env bash
set -xeo pipefail

pulumi preview --stack "${PULUMI_STACK}"
