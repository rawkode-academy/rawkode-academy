FROM docker.io/denoland/deno:2.1.1 AS base

WORKDIR /app

COPY deno.jsonc deno.lock ./
RUN deno install

COPY ./data-model data-model

FROM base AS read-model

EXPOSE 8000

COPY ./read-model read-model

RUN deno cache ./read-model/main.ts

CMD ["run", "--allow-all", "./read-model/main.ts"]

FROM base AS write-model

EXPOSE 9080

COPY ./write-model write-model

RUN deno cache ./write-model/main.ts

CMD ["run", "--allow-all", "./write-model/main.ts"]
