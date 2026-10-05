FROM --platform=linux/amd64 docker.io/mwader/static-ffmpeg:9.0.2@sha256:73e53e0efe712c0dda05ec65c18e7185f2638c33293d62dd9d541b081c0b523d AS ffmpeg
FROM --platform=linux/amd64 docker.io/library/node:24-bookworm-slim@sha256:5cbc7caba8c2c0f0bca675d1b61b9f2857e1cf1853c6164ee9dd409501a936e7
COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/
WORKDIR /app
COPY contract.mjs formats.mjs media.mjs runner.mjs recipe.json Dockerfile ./
USER node
EXPOSE 8080
ENTRYPOINT ["node", "runner.mjs"]
