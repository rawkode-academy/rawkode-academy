export interface PlatformServiceOptions {
	/**
	 * The name of the service (lowercase with hyphens)
	 * @example "casting-credits"
	 */
	readonly serviceName: string;

	/**
	 * Whether to include a write model with mutations
	 * @default false
	 */
	readonly includeWriteModel?: boolean;

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
