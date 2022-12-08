.PHONY: run

dependencies:
	docker compose up -d

run: dependencies
	deno run --allow-net=127.0.0.1:8000 main.ts
