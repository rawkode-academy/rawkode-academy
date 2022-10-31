#!/usr/bin/env bash
set -xeuo pipefail

cat > /etc/teleport.yaml <<EOCAT
version: v3

teleport:
  data_dir: /var/lib/teleport

auth_service:
  enabled: true
  listen_addr: 0.0.0.0:3025
  cluster_name: {{ workshopName }}.rawkode.academy
  proxy_listener_mode: multiplex
  authentication:
    type: github
  tokens:
    - proxy,node,app:lessthansecret

ssh_service:
  enabled: true

proxy_service:
  enabled: true
  web_listen_addr: "0.0.0.0:443"
  public_addr: {{ workshopName }}.rawkode.academy:443
  acme:
    enabled: "yes"
    email: david@rawkode.academy
EOCAT

systemctl enable teleport && systemctl restart teleport
sleep 5
