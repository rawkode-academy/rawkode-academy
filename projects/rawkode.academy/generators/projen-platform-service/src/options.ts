export interface PlatformServiceOptions {
	/**
	 * The name of the service (lowercase with hyphens)
	 * @example "casting-credits"
	 */
	readonly serviceName: string;

	/**
	 * Description of the service
	 * @example "GraphQL service for managing casting credits"
	 */
	readonly serviceDescription: string;


	/**
	 * The GraphQL type name (PascalCase)
	 * @example "CastingCredit"
	 */
	readonly graphqlTypeName: string;

	/**
	 * Whether to include a write model with mutations
	 * @default false
	 */
	readonly includeWriteModel?: boolean;

	/**
	 * Whether this service extends the Video type
	 * @default true
	 */
	readonly extendsVideo?: boolean;

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

	/**
	 * @deprecated Schema is now hand-crafted by the author
	 * Custom GraphQL schema fields
	 * Key is field name, value is GraphQL type
	 * @example { "name": "String!", "description": "String" }
	 */
	readonly schemaFields?: Record<string, string>;

	/**
	 * @deprecated Schema is now hand-crafted by the author
	 * Custom database columns
	 * Array of column definitions
	 * @example [{ name: "name", type: "text", nullable: false }]
	 */
	readonly databaseColumns?: DatabaseColumn[];

	/**
	 * Whether to use Cloudflare Durable Objects
	 * @default false
	 */
	readonly useDurableObjects?: boolean;

	/**
	 * Custom npm scripts to add
	 */
	readonly customScripts?: Record<string, string>;
}

export interface DatabaseColumn {
	/**
	 * Column name
	 */
	readonly name: string;

	/**
	 * Column type (text, integer, real, blob)
	 */
	readonly type: "text" | "integer" | "real" | "blob";

	/**
	 * Whether the column is nullable
	 * @default true
	 */
	readonly nullable?: boolean;

	/**
	 * Whether the column should be unique
	 * @default false
	 */
	readonly unique?: boolean;

	/**
	 * Default value for the column
	 */
	readonly defaultValue?: string | number | boolean;

	/**
	 * Whether this column references another table
	 */
	readonly references?: {
		table: string;
		column: string;
	};
}
