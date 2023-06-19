# syntax=docker/dockerfile:1
FROM cgr.dev/chainguard/node:20 AS base

FROM base as build

COPY --chown=node:node ["package.json", "pnpm-lock.yaml"]

RUN pnpm install
RUN pnpm run build

FROM base as server

ENV NODE_ENV=production
RUN pnpm install --prod --prefer-frozen-lockfile

ENV PAYLOAD_CONFIG_PATH=dist/payload.config.js

COPY --from=builder /home/node/app/dist ./dist
COPY --from=builder /home/node/app/build ./build

COPY --chown=node:node ./dist .

EXPOSE 3000

CMD ["node", "server.js"]
