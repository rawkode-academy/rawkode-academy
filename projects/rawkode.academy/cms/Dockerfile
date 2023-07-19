FROM node:18 AS base

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --strict-peer-dependencies --no-optional --prod --prefer-frozen-lockfile

FROM base as build

RUN pnpm install --strict-peer-dependencies --no-optional --prefer-frozen-lockfile
RUN pnpm install @swc/core

COPY . .
RUN pnpm run build

FROM base

LABEL org.opencontainers.image.source https://github.com/RawkodeAcademy/RawkodeAcademy
LABEL org.opencontainers.image.description="Rawkode Academy CMS"
LABEL org.opencontainers.image.licenses=MIT

WORKDIR /app

ENV NODE_ENV=production

COPY --from=build /app/build ./build
COPY --from=build /app/dist  ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 3000

CMD ["node", "dist/server.js"]
