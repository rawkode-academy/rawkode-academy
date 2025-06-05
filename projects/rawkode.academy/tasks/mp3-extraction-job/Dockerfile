FROM docker.io/denoland/deno:2.2.8 AS base

WORKDIR /app

# Install ffmpeg
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# Copy dependencies files
COPY deno.jsonc ./
RUN deno install

# Copy source code
COPY . .

# Cache the main script
RUN deno cache ./main.ts

# Run the extraction job
CMD ["run", "--allow-all", "./main.ts"]