.PHONY: run

dependencies:
	docker compose up -d

run: dependencies
	deno run \
		--allow-net=127.0.0.1:8000 \
		--allow-env=SURREALDB_HOST,SURREALDB_USER,SURREALDB_PASS,DATA_DIR \
		--allow-read="schema.surql","../../data" \
		main.ts
