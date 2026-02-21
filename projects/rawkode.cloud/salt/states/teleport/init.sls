{% set teleport_auth_type = salt['pillar.get']('teleport:auth_type', 'github') %}
{% set gh = salt['pillar.get']('teleport:github', {}) %}
{% set gh_client_id = gh.get('client_id', '') %}
{% set gh_client_secret = gh.get('client_secret', '') %}
{% set gh_org = gh.get('org', '') %}
{% set gh_team = gh.get('team', '') %}

teleport_repo_key:
  cmd.run:
    - name: |
        curl -fsSL https://apt.releases.teleport.dev/gpg -o /usr/share/keyrings/teleport-archive-keyring.asc
    - unless: test -f /usr/share/keyrings/teleport-archive-keyring.asc

teleport_repo:
  file.managed:
    - name: /etc/apt/sources.list.d/teleport.list
    - contents: |
        deb [signed-by=/usr/share/keyrings/teleport-archive-keyring.asc] https://apt.releases.teleport.dev/ubuntu noble stable/v17
    - require:
      - cmd: teleport_repo_key

teleport_installed:
  pkg.installed:
    - name: teleport
    - refresh: True
    - require:
      - file: teleport_repo

teleport_data_dir:
  file.directory:
    - name: /var/lib/teleport
    - user: root
    - group: root
    - mode: '0700'

teleport_config:
  file.managed:
    - name: /etc/teleport.yaml
    - source: salt://teleport/files/teleport.yaml.jinja
    - template: jinja
    - user: root
    - group: root
    - mode: '0600'
    - require:
      - pkg: teleport_installed

teleport_service:
  service.running:
    - name: teleport
    - enable: True
    - watch:
      - file: teleport_config
    - require:
      - pkg: teleport_installed
      - file: teleport_data_dir

teleport_auth_ready:
  cmd.run:
    - name: |
        for _ in $(seq 1 30); do
          if tctl --config=/etc/teleport.yaml status >/dev/null 2>&1; then
            exit 0
          fi
          sleep 2
        done
        tctl --config=/etc/teleport.yaml status
    - require:
      - service: teleport_service

{% if teleport_auth_type == 'github' and gh_client_id and gh_client_secret and gh_org and gh_team %}
teleport_github_connector:
  file.managed:
    - name: /etc/teleport/github-connector.yaml
    - source: salt://teleport/files/github-connector.yaml.jinja
    - template: jinja
    - user: root
    - group: root
    - mode: '0600'
    - makedirs: True
    - require:
      - pkg: teleport_installed

teleport_ensure_github_connector_present:
  cmd.run:
    - name: tctl --config=/etc/teleport.yaml create -f /etc/teleport/github-connector.yaml
    - unless: tctl --config=/etc/teleport.yaml get github/github >/dev/null 2>&1
    - require:
      - cmd: teleport_auth_ready
      - file: teleport_github_connector

teleport_update_github_connector:
  cmd.run:
    - name: |
        tctl --config=/etc/teleport.yaml rm github/github >/dev/null 2>&1 || true
        tctl --config=/etc/teleport.yaml create -f /etc/teleport/github-connector.yaml
    - onchanges:
      - file: teleport_github_connector
    - require:
      - cmd: teleport_auth_ready
{% else %}
teleport_github_connector_not_configured:
  test.show_notification:
    - text: Teleport GitHub connector skipped (set teleport.auth_type=github and github client_id/client_secret/org/team in pillar).
{% endif %}
