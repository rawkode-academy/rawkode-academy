FROM alpine/curl as curl

RUN curl --create-dirs -o /tmp/root.crt 'https://cockroachlabs.cloud/clusters/c0a93c8f-098a-42f3-9378-b28b4c81677c/cert'

FROM ghcr.io/zitadel/zitadel:latest

EXPOSE 8080

COPY --from=curl /tmp/root.crt /tmp/root.crt

CMD ["start-from-init", "--masterkeyFromEnv", "--tlsMode", "external"]
