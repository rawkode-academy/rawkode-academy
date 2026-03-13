FROM denoland/deno:2

WORKDIR /app

COPY deno.json .
COPY main.ts .

RUN deno cache main.ts

CMD ["deno", "run", "--allow-net", "--allow-env", "main.ts"]
