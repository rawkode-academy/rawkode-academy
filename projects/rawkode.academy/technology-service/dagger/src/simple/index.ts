import type { Container, Directory, Secret } from "@dagger.io/dagger";
import { argument, dag, func, object } from "@dagger.io/dagger";
import { createClient } from "@tursodatabase/api";

@object()
export class Simple {
	@func()
	async simple(
		@argument({ defaultPath: "." }) directory: Directory
	): Promise<Container> {
		const cloudflareId = dag.rawkodeAcademy().config().cloudflareAccountId();

		return await dag
			.nodeJs()
			.withBun(directory)
			.withExec(["bun", "install"])
			.withExec(["echo", `Cloudflare Account ID: ${cloudflareId}`])
			.withExec(["echo", "bun", "deploy"]);
	}
}
