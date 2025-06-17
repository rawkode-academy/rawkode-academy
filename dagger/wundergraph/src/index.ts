import {
	dag,
	type Directory,
	type File,
	func,
	object,
	type Secret,
} from "@dagger.io/dagger";

@object()
export class Wundergraph {
	/**
	 * Publish a GraphQL subgraph to WunderGraph Cosmo.
	 */
	@func()
	async publishSubgraph(
		serviceName: string,
		namespace: string,
		schemaFile: File,
		routingUrl: string,
		cosmoApiKey: Secret,
	): Promise<string> {
		const publishResult = await dag
			.container()
			.from("node:22-alpine")
			.withWorkdir("/publish")
			.withMountedFile("/publish/schema.gql", schemaFile)
			.withSecretVariable("COSMO_API_KEY", cosmoApiKey)
			.withExec([
				"npx",
				"wgc",
				"subgraph",
				"publish",
				serviceName,
				"--namespace",
				namespace,
				"--schema",
				"/publish/schema.gql",
				"--routing-url",
				routingUrl,
			]);

		if ((await publishResult.exitCode()) !== 0) {
			throw new Error(
				`Subgraph publish failed. Error: ${await publishResult.stdout()}${await publishResult.stderr()}`,
			);
		}

		return publishResult.stdout();
	}

	/**
	 * Generate GraphQL schema and publish subgraph to WunderGraph Cosmo.
	 */
	@func()
	async generateAndPublishSubgraph(
		serviceName: string,
		namespace: string,
		serviceDirectory: Directory,
		publishScript: string,
		routingUrl: string,
		cosmoApiKey: Secret,
	): Promise<string> {
		// Generate schema using bun
		const generatedSchema = await dag
			.bun()
			.container()
			.withMountedDirectory("/code", serviceDirectory)
			.withWorkdir("/code")
			.withExec(["bun", "run", publishScript]);

		// Get the generated schema file
		const schemaFile = generatedSchema.file("./read-model/schema.gql");

		// Publish the subgraph
		return this.publishSubgraph(
			serviceName,
			namespace,
			schemaFile,
			routingUrl,
			cosmoApiKey,
		);
	}
}
