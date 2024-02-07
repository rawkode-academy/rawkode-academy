import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: `${__dirname}/schema.graphql`,
	generates: {
		[`${__dirname}/generated.ts`]: {
			plugins: ["typescript", "typescript-operations", "typescript-resolvers"],
		},
	},
};

export default config;
