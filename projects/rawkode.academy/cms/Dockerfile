FROM cgr.dev/chainguard/wolfi-base AS base

RUN apk add --update python3 nodejs-20 corepack build-base

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY --chown=node:node package.json pnpm-lock.yaml ./

RUN pnpm install --strict-peer-dependencies --no-optional --prod --prefer-frozen-lockfile

FROM base as build

RUN pnpm install --strict-peer-dependencies --no-optional --prefer-frozen-lockfile
RUN pnpm run build

FROM base as backend

RUN adduser -D nonroot
WORKDIR /app

ENV NODE_ENV=production

ENV PAYLOAD_CONFIG_PATH=dist/payload.config.js

COPY --chown=nonroot:nonroot --from=build /home/node/app/dist ./

EXPOSE 3000

USER nonroot

CMD ["node", "server.js"]

FROM base as frontend

COPY --from=build /home/node/app/build ./build
