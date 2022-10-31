#!/usr/bin/env bash
set -xeuo pipefail

cat >> /etc/teleport.github.yaml <<EOCAT
kind: role
version: v5
metadata:
  name: rawkode
spec:
  allow:
    join_sessions:
    - name: join
      roles: ['*']
      kinds: ['*']
      modes: ['moderator', 'peer', 'observer']
    app_labels:
      '*': '*'
    db_labels:
      '*': '*'
    kubernetes_labels:
      '*': '*'
    logins:
    - root
    node_labels:
      '*': '*'
EOCAT

cat >> /etc/teleport.github.yaml <<EOCAT
---
kind: github
version: v3
metadata:
  name: github
spec:
  client_id: {{ githubClientId }}
  client_secret: {{ githubClientSecret }}
  display: Github
  redirect_url: https://{{ workshopName }}.rawkode.academy/v1/webapi/github/callback
  teams_to_roles:
  - organization: RawkodeAcademy
    team: klustered
    roles:
    - access
    - editor
    - auditor
    - rawkode
EOCAT

{{#each attendees}}
cat >> /etc/teleport.github.yaml <<EOCAT
  - organization: RawkodeAcademy
    team: {{ ../workshopName }}-{{ toLowerCase this }}
    roles:
    - {{ toLowerCase this }}
EOCAT
{{/each}}

{{#each attendees}}
cat >> /etc/teleport.github.yaml <<EOCAT
---
kind: role
version: v5
metadata:
  name: {{ toLowerCase this }}
spec:
  allow:
    join_sessions:
    - name: join
      roles: ['*']
      kinds: ['*']
      modes: ['observer', 'peer']
    logins: ['root']
    node_labels:
      'team': '{{ toLowerCase this }}'
    app_labels:
      'team': '{{ toLowerCase this }}'
EOCAT
{{/each}}


tctl create /etc/teleport.github.yaml
