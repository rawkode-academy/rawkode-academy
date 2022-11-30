#!/usr/bin/env sh
flux push artifact oci://ghcr.io/rawkodeacademy/cms-server-deploy:latest \
  --path="./deploy" \
  --source="$(git config --get remote.origin.url)" \
  --revision="$(git branch --show-current)/$(git rev-parse HEAD)"
