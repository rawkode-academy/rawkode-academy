ufw_installed:
  pkg.installed:
    - name: ufw

ufw_default_deny_incoming:
  cmd.run:
    - name: ufw default deny incoming
    - unless: ufw status verbose | grep -q "Default: deny (incoming)"
    - require:
      - pkg: ufw_installed

ufw_default_allow_outgoing:
  cmd.run:
    - name: ufw default allow outgoing
    - unless: ufw status verbose | grep -q "Default: allow (outgoing)"
    - require:
      - pkg: ufw_installed

ufw_allow_ssh:
  cmd.run:
    - name: ufw allow 22/tcp
    - unless: ufw status | grep -q "22/tcp"
    - require:
      - cmd: ufw_default_deny_incoming

ufw_allow_salt:
  cmd.run:
    - name: ufw allow 4505:4506/tcp
    - unless: ufw status | grep -q "4505:4506/tcp"
    - require:
      - cmd: ufw_default_deny_incoming

ufw_allow_https:
  cmd.run:
    - name: ufw allow 443/tcp
    - unless: ufw status | grep -q "443/tcp"
    - require:
      - cmd: ufw_default_deny_incoming

ufw_allow_teleport_auth:
  cmd.run:
    - name: ufw allow 3025/tcp
    - unless: ufw status | grep -q "3025/tcp"
    - require:
      - cmd: ufw_default_deny_incoming

ufw_enable:
  cmd.run:
    - name: ufw --force enable
    - unless: ufw status | grep -q "Status: active"
    - require:
      - cmd: ufw_allow_ssh
      - cmd: ufw_allow_salt
      - cmd: ufw_allow_https
      - cmd: ufw_allow_teleport_auth

ufw_service:
  service.running:
    - name: ufw
    - enable: True
    - require:
      - cmd: ufw_enable
