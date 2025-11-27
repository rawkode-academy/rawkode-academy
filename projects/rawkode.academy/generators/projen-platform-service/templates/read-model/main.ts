import { createYoga } from "graphql-yoga";
import { getSchema } from "./schema";

export interface Env {
{%- for db in bindings.d1Databases %}
	{{ db.binding }}: D1Database;
{%- endfor %}
{%- for secret in bindings.secretStoreSecrets %}
	{{ secret.binding }}: SecretsStoreSecret;
{%- endfor %}
{%- for kv in bindings.kvNamespaces %}
	{{ kv.binding }}: KVNamespace;
{%- endfor %}
{%- for bucket in bindings.r2Buckets %}
	{{ bucket.binding }}: R2Bucket;
{%- endfor %}
{%- for svc in bindings.services %}
	{{ svc.binding }}: Fetcher;
{%- endfor %}
{%- for wf in bindings.workflows %}
	{{ wf.binding }}: Workflow;
{%- endfor %}
{%- if bindings.ai %}
	{{ bindings.ai.binding }}: Ai;
{%- endif %}
{%- for key in bindings.vars %}
	{{ key[0] }}: string;
{%- endfor %}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const yoga = createYoga({
			schema: getSchema(env),
			graphqlEndpoint: "/",
		});

		return yoga.fetch(request, env, ctx);
	},
};
