{% set salt_private_interface = salt['pillar.get']('firewall:salt_private_interface', 'enp6s0') %}

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

ufw_remove_public_salt_rule:
  cmd.run:
    - name: ufw --force delete allow 4505:4506/tcp
    - onlyif: ufw status | grep -qE '^[[:space:]]*4505:4506/tcp[[:space:]]+ALLOW IN[[:space:]]+Anywhere$'
    - require:
      - cmd: ufw_default_deny_incoming

ufw_allow_salt:
  cmd.run:
    - name: ufw allow in on {{ salt_private_interface }} to any port 4505:4506 proto tcp
    - unless: ufw status | grep -qE "4505:4506/tcp on {{ salt_private_interface }}[[:space:]]+ALLOW IN"
    - require:
      - cmd: ufw_remove_public_salt_rule

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
