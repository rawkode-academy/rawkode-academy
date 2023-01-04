FROM node:18-bullseye

COPY . /app
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest && pnpm install && pnpm run build

FROM node:16-bullseye

WORKDIR /app

COPY --from=0 /app/lib /app
COPY --from=0 /app/node_modules /app/node_modules

CMD ["worker.js"]
