FROM denoland/deno:2.7.5

WORKDIR /app

COPY deno.json .
COPY main.ts .

RUN deno install
RUN deno cache main.ts

CMD ["deno", "run", "--allow-net", "--allow-env", "--cached-only", "main.ts"]
