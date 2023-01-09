#!/usr/bin/env bash
set -euxo pipefail

apt update && apt install -y jq
DNS_NAME=$(curl -H "Metadata-Flavor: Google" "http://metadata.google.internal/computeMetadata/v1/instance/attributes/?recursive=true" | jq -r '.DNS_NAME')

curl https://deb.releases.teleport.dev/teleport-pubkey.asc | apt-key add -
add-apt-repository --yes 'deb https://deb.releases.teleport.dev/ stable main'
DEBIAN_FRONTEND=noninteractive apt update && apt install -y teleport

GITHUB_CLIENT_ID=$(gcloud secrets versions access 1 --secret=doppler-cloud | jq -r ".GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET=$(gcloud secrets versions access 1 --secret=doppler-cloud | jq -r ".GITHUB_CLIENT_SECRET")
TELEPORT_JOIN_TOKEN=$(gcloud secrets versions access 1 --secret=rawkode-cloud-shared | jq -r ".TELEPORT_JOIN_TOKEN")

cat > /etc/teleport.yaml <<EOCAT
version: v2

teleport:
  data_dir: /var/lib/teleport

auth_service:
  enabled: true
  authentication:
    type: github
  proxy_listener_mode: multiplex
  listen_addr: 0.0.0.0:3025
  cluster_name: ${DNS_NAME}
  tokens:
  - "proxy,kube,app,db:${TELEPORT_JOIN_TOKEN}"

ssh_service:
  enabled: true

proxy_service:
  enabled: true
  public_addr: ${DNS_NAME}:443
  web_listen_addr: ":443"
  acme:
    enabled: "yes"
    email: david@rawkode.academy
EOCAT

cat >> /etc/teleport.github.yaml <<EOCAT
---
kind: github
version: v3
metadata:
  name: github
spec:
  client_id: ${GITHUB_CLIENT_ID}
  client_secret: ${GITHUB_CLIENT_SECRET}
  display: Github
  redirect_url: https://${DNS_NAME}/v1/webapi/github/callback
  teams_to_roles:
  - organization: RawkodeAcademy
    team: platform
    roles:
    - access
    - editor
    - auditor
EOCAT

systemctl enable teleport && systemctl start teleport

sleep 10

tctl create /etc/teleport.github.yaml
