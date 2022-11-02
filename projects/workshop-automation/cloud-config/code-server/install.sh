#!/usr/bin/env bash
set -xeuo pipefail

curl -fsSL https://code-server.dev/install.sh | sh -s -- --prefix=/usr/local

systemctl enable --now code-server@$USER

sleep 5

sed -ie 's/127.0.0.1/0.0.0.0/g' ~/.config/code-server/config.yaml
