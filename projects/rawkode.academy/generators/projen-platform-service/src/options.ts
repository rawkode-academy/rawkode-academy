export interface D1DatabaseBinding {
	binding: string;
	database_name: string;
	database_id: string;
	migrations_dir?: string;
}

export interface SecretStoreSecretBinding {
	binding: string;
	store_id: string;
	secret_name: string;
}

export interface KVNamespaceBinding {
	binding: string;
	id: string;
}

export interface R2BucketBinding {
	binding: string;
	bucket_name: string;
}

export interface ServiceBinding {
	binding: string;
	service: string;
}

export interface WorkflowBinding {
	binding: string;
	name: string;
	class_name: string;
	script_name?: string;
}

export interface SendEmailBinding {
	name: string;
	destination_address?: string;
	allowed_destination_addresses?: string[];
}

export interface CloudflareBindings {
	d1Databases?: D1DatabaseBinding[];
	secretStoreSecrets?: SecretStoreSecretBinding[];
	kvNamespaces?: KVNamespaceBinding[];
	r2Buckets?: R2BucketBinding[];
	services?: ServiceBinding[];
	workflows?: WorkflowBinding[];
	sendEmail?: SendEmailBinding[];
	ai?: { binding: string };
	vars?: Record<string, string>;
	crons?: string[];
}

export interface PlatformServiceOptions {
	/**
	 * The name of the service (lowercase with hyphens)
	 * @example "casting-credits"
	 */
	readonly serviceName: string;

	/**
	 * Whether to include a data model with Drizzle schema
	 * Set to false for bare services that manage their own data layer
	 * @default true
	 */
	readonly includeDataModel?: boolean;

	/**
	 * Whether to include a GraphQL read model
	 * @default true
	 */
	readonly includeReadModel?: boolean;

	/**
	 * Whether to include a write model with mutations
	 * @default false
	 */
	readonly includeWriteModel?: boolean;

	/**
	 * Whether to include an RPC model (capnweb-based)
	 * @default false
	 */
	readonly includeRpcModel?: boolean;

	/**
	 * Cloudflare environment bindings configuration
	 * Used to generate Env interface and wrangler.jsonc bindings
	 * When includeDataModel, includeReadModel, or includeWriteModel is true,
	 * bindings.d1Databases must include a database with binding "DB"
	 */
	readonly bindings?: CloudflareBindings;

	/**
	 * Additional npm dependencies to include
	 */
	readonly additionalDependencies?: Record<string, string>;

	/**
	 * Additional dev dependencies to include
	 */
	readonly additionalDevDependencies?: Record<string, string>;
}
