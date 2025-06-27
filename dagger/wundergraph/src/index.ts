import {
	type Directory,
	type File,
	dag,
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
			.bun()
			.container()
			.withSecretVariable("COSMO_API_KEY", cosmoApiKey)
			.withMountedFile("/code/read-model/schema.gql", schemaFile)
			.withExec([
				"bunx",
				"wgc",
				"subgraph",
				"publish",
				serviceName,
				"--namespace",
				namespace,
				"--schema",
				"./read-model/schema.gql",
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
