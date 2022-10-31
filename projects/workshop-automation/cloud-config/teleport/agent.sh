#!/usr/bin/env bash
set -xeuo pipefail

cat > /etc/teleport.yaml <<EOCAT
version: v3

auth_service:
  enabled: false

proxy_service:
  enabled: false

ssh_service:
  enabled: true
  labels:
    team: {{ toLowerCase attendee }}

teleport:
  auth_token: "lessthansecret"
  proxy_server: "{{ workshopName }}.rawkode.academy:443"
EOCAT

systemctl enable teleport && systemctl start teleport
