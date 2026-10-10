FROM --platform=linux/amd64 docker.io/library/node:24-bookworm-slim@sha256:5cbc7caba8c2c0f0bca675d1b61b9f2857e1cf1853c6164ee9dd409501a936e7
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
COPY runner.mjs render.mjs ./
USER node
EXPOSE 8080
ENTRYPOINT ["node", "runner.mjs"]
