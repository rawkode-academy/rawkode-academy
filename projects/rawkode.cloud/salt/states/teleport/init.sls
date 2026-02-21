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

teleport_oidc_connector:
  file.managed:
    - name: /etc/teleport/oidc-connector.yaml
    - source: salt://teleport/files/oidc-connector.yaml.jinja
    - template: jinja
    - user: root
    - group: root
    - mode: '0600'
    - makedirs: True
    - require:
      - pkg: teleport_installed

teleport_apply_oidc_connector:
  cmd.run:
    - name: tctl create -f /etc/teleport/oidc-connector.yaml
    - onchanges:
      - file: teleport_oidc_connector
    - require:
      - service: teleport_service
