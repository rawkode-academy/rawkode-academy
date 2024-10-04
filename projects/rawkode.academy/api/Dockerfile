FROM ghcr.io/grafbase/gateway:latest

COPY gateway.toml /etc/gateway.toml

ENTRYPOINT ["/bin/grafbase-gateway"]
CMD [ "--config", "/etc/gateway.toml"]
