#!/usr/bin/env bash
set -xeuo pipefail

source /etc/os-release
curl https://apt.releases.teleport.dev/gpg -o /usr/share/keyrings/teleport-archive-keyring.asc
echo "deb [signed-by=/usr/share/keyrings/teleport-archive-keyring.asc] https://apt.releases.teleport.dev/${ID?} ${VERSION_CODENAME?} stable/v11" \
  | tee /etc/apt/sources.list.d/teleport.list > /dev/null

DEBIAN_FRONTEND=noninteractive apt update && apt install --yes --no-install-recommends teleport
