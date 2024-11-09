FROM ghcr.io/zitadel/zitadel:v2.64.1

EXPOSE 8080

COPY config.yaml /etc/zitadel/config.yaml
COPY setup.yaml /etc/zitadel/setup.yaml

CMD ["start-from-init", "--config", "/etc/zitadel/config.yaml", "--steps", "/etc/zitadel/setup.yaml", "--masterkeyFromEnv", "--tlsMode", "external"]
