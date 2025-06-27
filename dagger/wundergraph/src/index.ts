import {
	type Directory,
	dag,
	type File,
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
	): Promise<File> {
		return await dag
			.bun()
			.container()
			.withMountedDirectory("/code", serviceDirectory)
			.withWorkdir("/code")
			.withSecretVariable("COSMO_API_KEY", cosmoApiKey)
			.withExec(["bun", "run", "read-model/publish.ts"])
			// .withExec([
			// 	"bunx",
			// 	"wgc",
			// 	"subgraph",
			// 	"publish",
			// 	serviceName,
			// 	"--namespace",
			// 	namespace,
			// 	"--schema",
			// 	"read-model/schema.gql",
			// 	"--routing-url",
			// 	routingUrl,
			// ])
			.file("read-model/schema.gql");
	}
}
