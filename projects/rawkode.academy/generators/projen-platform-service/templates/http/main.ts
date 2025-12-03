import { {{ serviceName | pascalCase }} } from "./http-service.js";

export interface Env {
{%- for db in bindings.d1Databases %}
	{{ db.binding }}: D1Database;
{%- endfor %}
{%- for kv in bindings.kvNamespaces %}
	{{ kv.binding }}: KVNamespace;
{%- endfor %}
{%- for bucket in bindings.r2Buckets %}
	{{ bucket.binding }}: R2Bucket;
{%- endfor %}
{%- for svc in bindings.services %}
	{{ svc.binding }}: Service;
{%- endfor %}
{%- for email in bindings.sendEmail %}
	{{ email.name }}: SendEmail;
{%- endfor %}
{%- if bindings.ai %}
	{{ bindings.ai.binding }}: Ai;
{%- endif %}
{%- for var in bindings.vars %}
	{{ var[0] }}: string;
{%- endfor %}
}

export default {{ serviceName | pascalCase }};
