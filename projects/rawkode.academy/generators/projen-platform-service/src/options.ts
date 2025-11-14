export interface PlatformServiceOptions {
	/**
	 * The name of the service (lowercase with hyphens)
	 * @example "casting-credits"
	 */
	readonly serviceName: string;

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
	 * Cloudflare D1 Database ID
	 * If not provided, a placeholder will be used
	 */
	readonly databaseId: string;

	/**
	 * Additional npm dependencies to include
	 */
	readonly additionalDependencies?: Record<string, string>;

	/**
	 * Additional dev dependencies to include
	 */
	readonly additionalDevDependencies?: Record<string, string>;
}
