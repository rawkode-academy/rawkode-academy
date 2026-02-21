fail2ban_installed:
  pkg.installed:
    - name: fail2ban

fail2ban_config:
  file.managed:
    - name: /etc/fail2ban/jail.local
    - source: salt://fail2ban/files/jail.local
    - user: root
    - group: root
    - mode: '0644'
    - require:
      - pkg: fail2ban_installed

fail2ban_service:
  service.running:
    - name: fail2ban
    - enable: True
    - watch:
      - file: fail2ban_config
    - require:
      - pkg: fail2ban_installed
