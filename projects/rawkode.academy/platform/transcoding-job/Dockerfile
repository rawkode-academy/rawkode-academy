FROM docker.io/denoland/deno:2.2.8 AS base

WORKDIR /app

RUN apt update && apt install --yes ffmpeg

COPY deno.jsonc deno.lock ./
RUN deno install

COPY . .

RUN deno cache ./main.ts

CMD ["run", "--allow-all", "./main.ts"]
