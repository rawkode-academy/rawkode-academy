#!/usr/bin/env bash
set -xeuo pipefail

DEBIAN_FRONTEND=noninteractive apt update && apt install --yes --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg-agent \
    software-properties-common
