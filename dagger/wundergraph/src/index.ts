import {
	type Directory,
	dag,
	func,
	object,
	type Secret,
} from "@dagger.io/dagger";

@object()
export class Wundergraph {
	/**
	 * Generate GraphQL schema and publish subgraph to WunderGraph Cosmo.
	 */
	@func()
	async generateAndPublishSubgraph(
		serviceName: string,
		namespace: string,
		serviceDirectory: Directory,
		routingUrl: string,
		cosmoApiKey: Secret,
	): Promise<string> {
		// Generate schema using bun
		const result = await dag
			.bun()
			.container()
			.withMountedDirectory("/code", serviceDirectory)
			.withWorkdir("/code")
			.withExec(["echo", "debug counter 1"])
			.withExec(["bun", "run", "read-model/publish.ts"])
			.withExec(["cat", "read-model/schema.gql"])
			.withSecretVariable("COSMO_API_KEY", cosmoApiKey)
			.withExec([
				"bunx",
				"wgc",
				"subgraph",
				"publish",
				serviceName,
				"--namespace",
				namespace,
				"--schema",
				"read-model/schema.gql",
				"--routing-url",
				routingUrl,
			]);
		if ((await result.exitCode()) !== 0) {
			throw new Error(
				`Subgraph publish failed. Error: ${await result.stdout()}${await result.stderr()}`,
			);
		}

		return result.stdout();
	}
}
