// The Worker RPC surface of a content write model. A service's
// write-model/main.ts is two lines:
//
//   import { contentWriteModel } from "@rawkodeacademy/content-write/worker";
//   import { models } from "./models";
//   export default contentWriteModel(models);
//
// Callers (the CMS) bind the worker as a Service and call these methods.
import { WorkerEntrypoint } from "cloudflare:workers";
import { describeModels } from "./describe";
import type { ServiceModels } from "./model";
import { type ContentWriteEnv, ContentStore } from "./store";
import type { Actor, ListQuery, Row } from "./types";

export function contentWriteModel(service: ServiceModels) {
	return class ContentWriteModel extends WorkerEntrypoint<ContentWriteEnv> {
		#store?: ContentStore;

		get store(): ContentStore {
			this.#store ??= new ContentStore(service, this.env);
			return this.#store;
		}

		async fetch(request: Request): Promise<Response> {
			if (new URL(request.url).pathname === "/health") {
				return new Response("ok", { headers: { "content-type": "text/plain" } });
			}
			return new Response("Not Found", { status: 404 });
		}

		models() {
			return this.store.models();
		}

		/** Field descriptions for editors, derived from the zod schemas. */
		describe() {
			return describeModels(service);
		}

		get(model: string, id: string) {
			return this.store.get(model, id);
		}

		list(model: string, query?: ListQuery) {
			return this.store.list(model, query);
		}

		revisions(model: string, id: string) {
			return this.store.revisions(model, id);
		}

		getList(model: string, parent: Row) {
			return this.store.getList(model, parent);
		}

		findReferences(model: string, column: string, value: string) {
			return this.store.findReferences(model, column, value);
		}

		create(model: string, input: Row, actor: Actor) {
			return this.store.create(model, input, actor);
		}

		update(
			model: string,
			id: string,
			patch: Row,
			options: { ifVersion: number },
			actor: Actor,
		) {
			return this.store.update(model, id, patch, options, actor);
		}

		delete(model: string, id: string, options: { ifVersion: number }, actor: Actor) {
			return this.store.delete(model, id, options, actor);
		}

		restore(model: string, id: string, fromVersion: number, actor: Actor) {
			return this.store.restore(model, id, fromVersion, actor);
		}

		setList(
			model: string,
			parent: Row,
			items: Row[],
			options: { ifVersion: number },
			actor: Actor,
		) {
			return this.store.setList(model, parent, items, options, actor);
		}
	};
}

/** The RPC methods a content write model exposes, for typing Service bindings. */
export type ContentWriteRpc = {
	describe(): ReturnType<typeof describeModels>;
} & Pick<
	ContentStore,
	| "models"
	| "get"
	| "list"
	| "revisions"
	| "getList"
	| "findReferences"
	| "create"
	| "update"
	| "delete"
	| "restore"
	| "setList"
>;
