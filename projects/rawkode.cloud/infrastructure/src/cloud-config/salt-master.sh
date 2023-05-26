#!/usr/bin/env bash
set -euxo pipefail

# Get Private IPv4 Address
PRIVATE_IPv4=$(curl -s https://metadata.platformequinix.com/metadata | jq -r '.network.addresses | map(select(.public==false and .management==true)) | first | .address')

# Install Salt Master, Binding to Private IPv4 Address
curl -o bootstrap-salt.sh -L https://bootstrap.saltproject.io
sh bootstrap-salt.sh -A ${PRIVATE_IPv4} -i gru -UMPX onedir 3006.1

# Prepare Salt for Self Management
cat <<EOF >/etc/salt/master.d/master.conf
autosign_grains_dir: /etc/salt/autosign-grains
fileserver_backend:
  - roots
  - gitfs

gitfs_remotes:
  - https://github.com/RawkodeAcademy/RawkodeAcademy:
      - root: projects/rawkode.cloud/salt
      - base: main
      - update_interval: 600
  - https://github.com/saltstack-formulas/kubernetes-formula

ext_pillar:
  - http_json:
      url: https://metadata.platformequinix.com/metadata
EOF
