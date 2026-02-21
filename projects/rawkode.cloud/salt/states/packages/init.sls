system_packages_uptodate:
  pkg.uptodate:
    - refresh: True

essential_packages:
  pkg.installed:
    - pkgs:
      - curl
      - wget
      - vim
      - htop
      - unzip
      - jq
      - apt-transport-https
      - ca-certificates
      - gnupg
