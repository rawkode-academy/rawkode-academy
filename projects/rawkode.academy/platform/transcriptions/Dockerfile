FROM docker.io/denoland/deno:2.2.4 AS base

WORKDIR /app

COPY package.json deno.lock ./
RUN deno install

FROM base AS write-model

EXPOSE 9080

COPY ./write-model write-model

RUN deno cache ./write-model/main.ts

CMD ["run", "--allow-all", "./write-model/main.ts"]
